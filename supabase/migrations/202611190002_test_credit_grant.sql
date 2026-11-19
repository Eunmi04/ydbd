begin;

-- One additional TEST grant per wallet. The existing append-only ledger owns balances.
create function private.grant_initial_test_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.credit_ledger (wallet_id, user_id, entry_type, amount, idempotency_key, metadata)
  values (new.id, new.user_id, 'TEST_GRANT', 1000000, 'test-grant:20261119:1000000',
    jsonb_build_object('source', 'initial_test_credit'))
  on conflict (user_id, idempotency_key) do nothing;
  return new;
end;
$$;

revoke execute on function private.grant_initial_test_credit() from public, anon, authenticated;

create trigger credit_wallets_grant_initial_test_credit
after insert on public.credit_wallets
for each row when (new.status = 'ACTIVE') execute function private.grant_initial_test_credit();

insert into public.credit_ledger (wallet_id, user_id, entry_type, amount, idempotency_key, metadata)
select id, user_id, 'TEST_GRANT', 1000000, 'test-grant:20261119:1000000',
  jsonb_build_object('source', 'initial_test_credit')
from public.credit_wallets
where status = 'ACTIVE'
on conflict (user_id, idempotency_key) do nothing;

commit;
