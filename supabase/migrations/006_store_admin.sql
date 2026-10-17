-- The Yard — service-role-only coin grant, used by the Stripe webhook
-- Run after 005_store.sql, in the SQL Editor.
--
-- Unlike earn_coins() (which trusts auth.uid() and is capped for regular
-- players), this takes an explicit user id and has no cap — it must only
-- ever be callable by the service role, never by a signed-in player, which
-- is why it's revoked from `authenticated` below.

create or replace function admin_grant_coins(p_user_id uuid, amount integer, reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if amount <= 0 then
    raise exception 'invalid grant amount';
  end if;

  insert into wallets (user_id, balance, lifetime_earned)
    values (p_user_id, amount, amount)
  on conflict (user_id) do update
    set balance = wallets.balance + excluded.balance,
        lifetime_earned = wallets.lifetime_earned + excluded.balance,
        updated_at = now()
  returning balance into new_balance;

  insert into wallet_transactions (user_id, delta, reason)
    values (p_user_id, amount, reason);

  return new_balance;
end;
$$;

revoke execute on function admin_grant_coins(uuid, integer, text) from public, anon, authenticated;
grant execute on function admin_grant_coins(uuid, integer, text) to service_role;
