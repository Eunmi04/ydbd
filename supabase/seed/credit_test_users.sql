-- DEVELOPMENT ONLY. Run manually after replacing all four placeholders with
-- distinct, existing auth.users.id values. This file is not supabase/seed.sql.
do $seed$
declare
  target_user_ids uuid[] := array[
    '<USER_A_UUID>'::uuid,
    '<USER_B_UUID>'::uuid,
    '<USER_C_UUID>'::uuid,
    '<USER_D_UUID>'::uuid
  ];
begin
  if (select count(distinct x.user_id)
      from unnest(target_user_ids) as x(user_id)) <> 4 then
    raise exception 'seed requires four distinct user IDs';
  end if;

  if (select count(*) from auth.users
      where id = any(target_user_ids)) <> 4 then
    raise exception 'all four seed users must already exist in auth.users';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = any(target_user_ids)
      and idempotency_key = 'seed:test-grant:5000:v1'
      and (entry_type <> 'TEST_GRANT' or amount <> 5000)
  ) then
    raise exception 'seed idempotency key already has different data';
  end if;

  insert into public.credit_wallets (user_id)
  select id from auth.users where id = any(target_user_ids)
  on conflict (user_id) do nothing;

  -- Demo-only verification; never treat this seed as a production identity check.
  update public.profiles
  set verification_status = 'VERIFIED', school_name = coalesce(school_name, '캡스톤 테스트 학교')
  where id = any(target_user_ids) and account_status = 'ACTIVE';

  insert into public.credit_ledger (
    wallet_id, user_id, entry_type, amount, idempotency_key, metadata
  )
  select w.id, w.user_id, 'TEST_GRANT', 5000,
    'seed:test-grant:5000:v1',
    jsonb_build_object('source', 'development_seed')
  from public.credit_wallets as w
  where w.user_id = any(target_user_ids)
  on conflict (user_id, idempotency_key) do nothing;
end;
$seed$;
