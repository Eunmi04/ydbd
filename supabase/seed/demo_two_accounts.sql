-- Admin SQL Editor only. Confirmed targets: 1234@gmail.com / 5678@gmail.com.
-- Requires migration 014. Run once; repeat execution does not duplicate grants.
begin;
do $demo$
declare
  target_emails text[] := array['1234@gmail.com', '5678@gmail.com'];
  target_ids uuid[];
  v_demo_key constant text := 'demo:2026-10-22:two-accounts:v1';
begin
  select array_agg(u.id order by u.id) into target_ids
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = any(target_emails) and p.account_status = 'ACTIVE';
  if coalesce(cardinality(target_ids), 0) <> 2 then
    raise exception 'Both specified accounts must exist and have ACTIVE profiles. No changes applied.';
  end if;
  if exists (select 1 from public.credit_wallets w
    where w.user_id = any(target_ids) and w.status <> 'ACTIVE') then
    raise exception 'A specified test wallet is not ACTIVE. Review it with the administrator; no status is changed by this seed.';
  end if;
  if exists (select 1 from public.credit_ledger l
    where l.user_id = any(target_ids) and l.idempotency_key = v_demo_key || ':grant:20000'
      and (l.entry_type <> 'TEST_GRANT' or l.amount <> 20000)) then
    raise exception 'Demo grant key already contains different data. No changes applied.';
  end if;
  if exists (select 1 from private.demo_profile_backups b
    where b.demo_key = v_demo_key and b.restored_at is not null) then
    raise exception 'This demo was already restored. Use a new reviewed demo key for another run.';
  end if;
  insert into private.demo_profile_backups
    (demo_key, user_id, original_verification_status, original_demo_verification)
  select v_demo_key, p.id, p.verification_status, p.demo_verification
  from public.profiles p where p.id = any(target_ids)
  on conflict (demo_key, user_id) do nothing;

  update public.profiles set verification_status = 'VERIFIED', demo_verification = true
  where id = any(target_ids) and account_status = 'ACTIVE';

  insert into public.credit_wallets (user_id)
  select unnest(target_ids) on conflict (user_id) do nothing;
  -- Same append-only TEST_GRANT mechanism as credit_test_users.sql.
  insert into public.credit_ledger (wallet_id, user_id, entry_type, amount, idempotency_key, metadata)
  select w.id, w.user_id, 'TEST_GRANT', 20000, v_demo_key || ':grant:20000',
    jsonb_build_object('source', 'explicit_demo_seed', 'demo_key', v_demo_key)
  from public.credit_wallets w where w.user_id = any(target_ids)
  on conflict (user_id, idempotency_key) do nothing;
end;
$demo$;
commit;

select p.id, p.email, p.nickname, p.account_status, p.verification_status, p.demo_verification
from public.profiles p where lower(p.email) in ('1234@gmail.com', '5678@gmail.com');
