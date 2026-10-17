-- The Yard — seasonal drops + general sale/discount support
-- Run after 006_store_admin.sql, in the SQL Editor.

alter table store_items add column if not exists discount_pct integer check (discount_pct between 0 and 100);
alter table store_items add column if not exists sale_label text;

-- Re-defines purchase_with_coins (from 006) to apply discount_pct, so a
-- sale price is enforced server-side, not just shown client-side.
create or replace function purchase_with_coins(p_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item store_items%rowtype;
  charge integer;
  new_balance integer;
begin
  select * into item from store_items where id = p_item_id and active;
  if item.id is null then
    raise exception 'item not found';
  end if;
  if item.price_coins is null then
    raise exception 'this item is not coin-priced';
  end if;

  charge := item.price_coins;
  if item.discount_pct is not null then
    charge := round(charge * (1 - item.discount_pct / 100.0));
  end if;

  update wallets
    set balance = balance - charge, updated_at = now()
    where user_id = auth.uid() and balance >= charge
    returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient balance';
  end if;

  insert into wallet_transactions (user_id, delta, reason)
    values (auth.uid(), -charge, 'store: ' || item.name);

  insert into inventory (user_id, item_id) values (auth.uid(), p_item_id)
    on conflict do nothing;

  insert into purchases (user_id, item_id, provider, price_paid_coins)
    values (auth.uid(), p_item_id, 'coins', charge);

  return new_balance;
end;
$$;

-- Halloween drop — cosmetics only available while the season is active
-- (gated client-side by date; `seasonal` just tags what they belong to).
insert into store_items (name, kind, icon, price_coins, meta, seasonal) values
  ('Glow Yard Fit', 'cosmetic', '🎃', 200, '{"color":"#ff7518"}', 'halloween'),
  ('Midnight Fit', 'cosmetic', '🦇', 200, '{"color":"#4b0082"}', 'halloween')
on conflict do nothing;

-- A limited-time discounted coin pack — demonstrates the general sale
-- mechanic (discount_pct + sale_label), reusable for any future sale.
insert into store_items (name, kind, icon, price_cents, meta, seasonal, discount_pct, sale_label) values
  ('Spooky Bundle: 2,000 Yard Coin', 'coin_pack', '🪙', 399, '{"coins":2000}', 'halloween', 20, '🎃 Harvest Bash Sale')
on conflict do nothing;
