-- The Yard — Yard Coin economy
-- Run after 001_init.sql, in the SQL Editor.

create table if not exists wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  updated_at timestamptz not null default now()
);

alter table wallets enable row level security;

create policy "Wallets are viewable by everyone"
  on wallets for select
  using (true);

-- No direct insert/update policy — balances only change through the
-- SECURITY DEFINER functions below, so a client can never write its own
-- balance directly (prevents trivial coin-balance forgery).

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table wallet_transactions enable row level security;

create policy "Users can view their own transactions"
  on wallet_transactions for select
  using (auth.uid() = user_id);

-- Earning is capped per call so a compromised/modified client can't mint
-- unlimited coins — each minigame payout is well under this ceiling.
create or replace function earn_coins(amount integer, reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if amount <= 0 or amount > 250 then
    raise exception 'invalid earn amount';
  end if;

  insert into wallets (user_id, balance, lifetime_earned)
    values (auth.uid(), amount, amount)
  on conflict (user_id) do update
    set balance = wallets.balance + excluded.balance,
        lifetime_earned = wallets.lifetime_earned + excluded.balance,
        updated_at = now()
  returning balance into new_balance;

  insert into wallet_transactions (user_id, delta, reason)
    values (auth.uid(), amount, reason);

  return new_balance;
end;
$$;

create or replace function spend_coins(amount integer, reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if amount <= 0 then
    raise exception 'invalid spend amount';
  end if;

  update wallets
    set balance = balance - amount, updated_at = now()
    where user_id = auth.uid() and balance >= amount
    returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient balance';
  end if;

  insert into wallet_transactions (user_id, delta, reason)
    values (auth.uid(), -amount, reason);

  return new_balance;
end;
$$;

grant execute on function earn_coins(integer, text) to authenticated;
grant execute on function spend_coins(integer, text) to authenticated;

-- Leaderboard ranks by lifetime earnings, not spendable balance, so
-- spending coins in the store never costs a player their rank.
create or replace view leaderboard_view as
select p.id as user_id, p.display_name, p.color, w.lifetime_earned
from wallets w
join profiles p on p.id = w.user_id
order by w.lifetime_earned desc;

alter publication supabase_realtime add table wallets;
