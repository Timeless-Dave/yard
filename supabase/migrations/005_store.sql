-- The Yard — store, cosmetics, and the Stripe payment scaffold
-- Run after 004_membership.sql, in the SQL Editor.

create table if not exists store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('cosmetic', 'coin_pack')),
  icon text not null default '🎁',
  -- Exactly one of these is set: coin-priced items are bought with Yard
  -- Coin via the spend_coins path; cash items go through Stripe Checkout.
  price_coins integer,
  price_cents integer,
  meta jsonb not null default '{}'::jsonb,
  seasonal text, -- e.g. 'halloween'; null = always available
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint one_price check (
    (price_coins is not null and price_cents is null) or
    (price_coins is null and price_cents is not null)
  )
);

alter table store_items enable row level security;

create policy "Store items are viewable by everyone"
  on store_items for select
  using (true);

-- Cosmetics owned by a player (coin purchases land here immediately;
-- cash purchases land here from the Stripe webhook after payment).
create table if not exists inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references store_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table inventory enable row level security;

create policy "Users can view their own inventory"
  on inventory for select
  using (auth.uid() = user_id);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references store_items (id),
  provider text not null check (provider in ('coins', 'stripe')),
  price_paid_coins integer,
  price_paid_cents integer,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table purchases enable row level security;

create policy "Users can view their own purchases"
  on purchases for select
  using (auth.uid() = user_id);

-- Atomic coin-priced purchase: deduct balance, grant inventory, log
-- purchase — all in one server-side transaction so a client can't grant
-- itself an item without actually paying for it.
create or replace function purchase_with_coins(p_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item store_items%rowtype;
  new_balance integer;
begin
  select * into item from store_items where id = p_item_id and active;
  if item.id is null then
    raise exception 'item not found';
  end if;
  if item.price_coins is null then
    raise exception 'this item is not coin-priced';
  end if;

  update wallets
    set balance = balance - item.price_coins, updated_at = now()
    where user_id = auth.uid() and balance >= item.price_coins
    returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient balance';
  end if;

  insert into wallet_transactions (user_id, delta, reason)
    values (auth.uid(), -item.price_coins, 'store: ' || item.name);

  insert into inventory (user_id, item_id) values (auth.uid(), p_item_id)
    on conflict do nothing;

  insert into purchases (user_id, item_id, provider, price_paid_coins)
    values (auth.uid(), p_item_id, 'coins', item.price_coins);

  return new_balance;
end;
$$;

grant execute on function purchase_with_coins(uuid) to authenticated;

-- Starter catalog. Edit freely in the Supabase table editor.
insert into store_items (name, kind, icon, price_coins, meta) values
  ('Gold Trim Fit', 'cosmetic', '✨', 150, '{"color":"#ffd84d"}'),
  ('Black & Gold Fit', 'cosmetic', '🖤', 150, '{"color":"#1a1a1a"}'),
  ('Crimson Fit', 'cosmetic', '🔴', 150, '{"color":"#b4182f"}')
on conflict do nothing;

insert into store_items (name, kind, icon, price_cents, meta) values
  ('500 Yard Coin', 'coin_pack', '🪙', 199, '{"coins":500}'),
  ('1,500 Yard Coin', 'coin_pack', '🪙', 499, '{"coins":1500}'),
  ('4,000 Yard Coin', 'coin_pack', '🪙', 999, '{"coins":4000}')
on conflict do nothing;
