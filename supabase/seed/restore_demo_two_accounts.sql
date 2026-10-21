-- Admin SQL Editor only. Restores verification metadata, preserving ledger history.
begin;
do $restore$
begin
  if (select count(*) from private.demo_profile_backups
      where demo_key = 'demo:2026-10-22:two-accounts:v1') <> 2 then
    raise exception 'Expected exactly two backed-up demo accounts. No changes applied.';
  end if;
  if exists (select 1 from public.room_credit_reservations r
    join private.demo_profile_backups b on b.user_id = r.user_id
    where b.demo_key = 'demo:2026-10-22:two-accounts:v1' and r.status = 'HELD') then
    raise exception 'Complete settlement or cancel the room before restoring demo verification.';
  end if;
  if exists (select 1 from public.profiles p join private.demo_profile_backups b on b.user_id = p.id
    where b.demo_key = 'demo:2026-10-22:two-accounts:v1' and b.restored_at is null
      and (p.verification_status <> 'VERIFIED' or not p.demo_verification)) then
    raise exception 'An administrator changed verification after setup. Review before restoring.';
  end if;
  update public.profiles p
  set verification_status = b.original_verification_status,
      demo_verification = b.original_demo_verification
  from private.demo_profile_backups b
  where p.id = b.user_id and b.demo_key = 'demo:2026-10-22:two-accounts:v1'
    and b.restored_at is null;
  update private.demo_profile_backups set restored_at = now()
  where demo_key = 'demo:2026-10-22:two-accounts:v1' and restored_at is null;
end;
$restore$;
commit;
