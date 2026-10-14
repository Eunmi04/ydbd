-- Rebuild the current version's per-member amounts from server-owned room and
-- HELD reservation data. An older confirmation_version never counts again.
create function private.rebuild_settlement_items(p_settlement_id uuid, p_existing boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.settlements%rowtype;
  m record;
  total_members integer;
  held_members integer;
  unknown_members integer;
  rider_count integer;
  rider_index integer := 0;
  share bigint;
begin
  select * into strict s from public.settlements where id = p_settlement_id;
  select count(*), count(r.id),
    count(*) filter (where m.boarded_status = 'UNKNOWN'),
    count(*) filter (where m.boarded_status = 'BOARDED')
  into total_members, held_members, unknown_members, rider_count
  from public.room_members m
  left join public.room_credit_reservations r
    on r.room_id = m.room_id and r.user_id = m.user_id and r.status = 'HELD'
  where m.room_id = s.room_id and m.member_status = 'JOINED';
  if total_members < 2 or held_members <> total_members or unknown_members <> 0
     or rider_count = 0 or s.actual_fare < rider_count then
    raise exception 'ROOM_NOT_READY';
  end if;
  if not exists (select 1 from public.room_members
                 where room_id = s.room_id and user_id = s.submitted_by
                   and boarded_status = 'BOARDED') then
    raise exception 'HOST_NOT_BOARDED';
  end if;
  for m in
    select rm.user_id, rm.boarded_status, r.amount
    from public.room_members rm
    join public.room_credit_reservations r
      on r.room_id = rm.room_id and r.user_id = rm.user_id and r.status = 'HELD'
    where rm.room_id = s.room_id and rm.member_status = 'JOINED'
    order by rm.joined_at, rm.id
  loop
    share := 0;
    if m.boarded_status = 'BOARDED' then
      share := s.actual_fare / rider_count
        + case when rider_index < s.actual_fare % rider_count then 1 else 0 end;
      rider_index := rider_index + 1;
    end if;
    if share > m.amount then raise exception 'FARE_EXCEEDS_RESERVED_CREDIT'; end if;
    if p_existing then
      update public.settlement_items set
        deposit_amount = m.amount, share_amount = share,
        refund_amount = m.amount - share,
        boarded = (m.boarded_status = 'BOARDED'),
        confirmation_status = case when m.user_id = s.submitted_by then 'CONFIRMED' else 'PENDING' end,
        confirmation_version = s.settlement_version,
        confirmed_at = case when m.user_id = s.submitted_by then now() else null end,
        dispute_reason = null
      where settlement_id = s.id and user_id = m.user_id;
      if not found then raise exception 'SETTLEMENT_ITEM_MISSING'; end if;
    else
      insert into public.settlement_items
        (settlement_id, user_id, deposit_amount, share_amount, refund_amount,
         boarded, confirmation_status, confirmation_version, confirmed_at)
      values (s.id, m.user_id, m.amount, share, m.amount - share,
        m.boarded_status = 'BOARDED',
        case when m.user_id = s.submitted_by then 'CONFIRMED' else 'PENDING' end,
        s.settlement_version,
        case when m.user_id = s.submitted_by then now() else null end);
    end if;
  end loop;
  return total_members;
end;
$$;

create function public.report_no_show(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'report_no_show', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_row.status not in ('FIXED', 'IN_PROGRESS') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update public.room_members set boarded_status = 'NO_SHOW', boarded_at = now()
  where room_id = p_room_id and user_id = actor and member_status = 'JOINED'
    and boarded_status = 'UNKNOWN';
  if not found then raise exception 'USER_NOT_MEMBER_OR_ALREADY_REPORTED'; end if;
  if room_row.status = 'FIXED' then
    update public.rooms set status = 'IN_PROGRESS'
    where id = p_room_id and status = 'FIXED';
  end if;
  return private.finish_request(p_request_id,
    jsonb_build_object('room_id', p_room_id, 'boarded_status', 'NO_SHOW', 'room_status', 'IN_PROGRESS'));
end;
$$;

create function public.submit_fare(
  p_room_id uuid, p_actual_fare bigint, p_evidence_type text,
  p_evidence_reference text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
  settlement_id uuid;
  item_count integer;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'submit_fare', jsonb_build_object(
    'room_id', p_room_id, 'actual_fare', p_actual_fare,
    'evidence_type', p_evidence_type, 'evidence_reference', p_evidence_reference));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_row.host_id <> actor then raise exception 'HOST_REQUIRED'; end if;
  if room_row.status <> 'IN_PROGRESS' then raise exception 'INVALID_STATE_TRANSITION'; end if;
  if p_actual_fare is null or p_actual_fare <= 0 then raise exception 'INVALID_FARE'; end if;
  if p_evidence_type not in ('SAMPLE', 'REDACTED_URL')
     or nullif(btrim(p_evidence_reference), '') is null then
    raise exception 'EVIDENCE_REQUIRED';
  end if;
  update public.rooms set status = 'FARE_SUBMITTED'
  where id = p_room_id and status = 'IN_PROGRESS';
  insert into public.settlements
    (room_id, actual_fare, submitted_by, evidence_type, evidence_reference,
     status, submitted_at)
  values (p_room_id, p_actual_fare, actor, p_evidence_type,
    btrim(p_evidence_reference), 'CONFIRMING', now())
  returning id into settlement_id;
  item_count := private.rebuild_settlement_items(settlement_id, false);
  update public.rooms set status = 'CONFIRMING'
  where id = p_room_id and status = 'FARE_SUBMITTED';
  return private.finish_request(p_request_id, jsonb_build_object(
    'settlement_id', settlement_id, 'settlement_version', 1,
    'room_status', 'CONFIRMING', 'member_count', item_count));
end;
$$;

create function public.confirm_settlement(
  p_settlement_id uuid, p_settlement_version integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  s public.settlements%rowtype;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'confirm_settlement', jsonb_build_object(
    'settlement_id', p_settlement_id, 'version', p_settlement_version));
  if previous is not null then return previous; end if;
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then raise exception 'SETTLEMENT_NOT_FOUND'; end if;
  if s.status <> 'CONFIRMING' or s.settlement_version <> p_settlement_version then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update public.settlement_items set confirmation_status = 'CONFIRMED', confirmed_at = now()
  where settlement_id = p_settlement_id and user_id = actor
    and confirmation_version = p_settlement_version and confirmation_status = 'PENDING';
  if not found then raise exception 'USER_NOT_MEMBER_OR_ALREADY_CONFIRMED'; end if;
  return private.finish_request(p_request_id, jsonb_build_object(
    'settlement_id', p_settlement_id, 'settlement_version', p_settlement_version,
    'confirmation_status', 'CONFIRMED'));
end;
$$;

create function public.dispute_settlement(
  p_settlement_id uuid, p_settlement_version integer,
  p_reason text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  s public.settlements%rowtype;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'dispute_settlement', jsonb_build_object(
    'settlement_id', p_settlement_id, 'version', p_settlement_version,
    'reason', p_reason));
  if previous is not null then return previous; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'DISPUTE_REASON_REQUIRED'; end if;
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then raise exception 'SETTLEMENT_NOT_FOUND'; end if;
  if s.status <> 'CONFIRMING' or s.settlement_version <> p_settlement_version then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update public.settlement_items
  set confirmation_status = 'DISPUTED', confirmed_at = null,
      dispute_reason = btrim(p_reason)
  where settlement_id = s.id and user_id = actor
    and confirmation_version = p_settlement_version
    and confirmation_status in ('PENDING', 'CONFIRMED');
  if not found then raise exception 'USER_NOT_MEMBER'; end if;
  update public.settlements set status = 'DISPUTED' where id = s.id and status = 'CONFIRMING';
  update public.rooms set status = 'DISPUTED'
  where id = s.room_id and status = 'CONFIRMING';
  return private.finish_request(p_request_id, jsonb_build_object(
    'settlement_id', s.id, 'settlement_version', s.settlement_version,
    'settlement_status', 'DISPUTED'));
end;
$$;

-- A revised fare opens a new confirmation version; previous confirmations do
-- not match the new version and all non-host participants must confirm again.
create function public.revise_fare(
  p_settlement_id uuid, p_actual_fare bigint, p_evidence_type text,
  p_evidence_reference text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  s public.settlements%rowtype;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'revise_fare', jsonb_build_object(
    'settlement_id', p_settlement_id, 'actual_fare', p_actual_fare,
    'evidence_type', p_evidence_type, 'evidence_reference', p_evidence_reference));
  if previous is not null then return previous; end if;
  select * into s from public.settlements where id = p_settlement_id for update;
  if not found then raise exception 'SETTLEMENT_NOT_FOUND'; end if;
  if s.submitted_by <> actor then raise exception 'HOST_REQUIRED'; end if;
  if s.status <> 'DISPUTED' then raise exception 'INVALID_STATE_TRANSITION'; end if;
  if p_actual_fare is null or p_actual_fare <= 0 then raise exception 'INVALID_FARE'; end if;
  if p_evidence_type not in ('SAMPLE', 'REDACTED_URL')
     or nullif(btrim(p_evidence_reference), '') is null then
    raise exception 'EVIDENCE_REQUIRED';
  end if;
  update public.settlements set
    settlement_version = settlement_version + 1,
    actual_fare = p_actual_fare, evidence_type = p_evidence_type,
    evidence_reference = btrim(p_evidence_reference),
    status = 'CONFIRMING', submitted_at = now()
  where id = s.id and status = 'DISPUTED'
  returning * into s;
  perform private.rebuild_settlement_items(s.id, true);
  update public.rooms set status = 'CONFIRMING'
  where id = s.room_id and status = 'DISPUTED';
  return private.finish_request(p_request_id, jsonb_build_object(
    'settlement_id', s.id, 'settlement_version', s.settlement_version,
    'settlement_status', 'CONFIRMING'));
end;
$$;

create function public.finalize_settlement(
  p_settlement_id uuid, p_settlement_version integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  s public.settlements%rowtype;
  r public.rooms%rowtype;
  m record;
  payout record;
  reservation public.room_credit_reservations%rowtype;
  wallet_id uuid;
  release_id uuid;
  target_room_id uuid;
  rider_count integer;
  rider_index integer := 0;
  expected_share bigint;
  item_count integer := 0;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'finalize_settlement', jsonb_build_object(
    'settlement_id', p_settlement_id, 'version', p_settlement_version));
  if previous is not null then return previous; end if;
  -- Lock order is room, settlement, then per-user wallets.
  select room_id into strict target_room_id from public.settlements where id = p_settlement_id;
  select * into r from public.rooms where id = target_room_id for update;
  select * into s from public.settlements where id = p_settlement_id for update;
  if s.status = 'COMPLETED' then raise exception 'SETTLEMENT_ALREADY_APPLIED'; end if;
  if r.host_id <> actor then raise exception 'HOST_REQUIRED'; end if;
  if r.status <> 'CONFIRMING' or s.status <> 'CONFIRMING'
     or s.settlement_version <> p_settlement_version then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  select count(*) into rider_count from public.room_members
  where room_id = r.id and member_status = 'JOINED' and boarded_status = 'BOARDED';
  if rider_count < 1 or s.actual_fare < rider_count then raise exception 'ROOM_NOT_READY'; end if;
  -- Verify every stored share against current server data before any ledger write.
  for m in
    select rm.user_id, rm.boarded_status, si.boarded, si.share_amount, si.deposit_amount,
      si.refund_amount, si.confirmation_status, si.confirmation_version,
      rr.amount as held_amount
    from public.room_members rm
    left join public.settlement_items si
      on si.settlement_id = s.id and si.user_id = rm.user_id
    left join public.room_credit_reservations rr
      on rr.room_id = r.id and rr.user_id = rm.user_id and rr.status = 'HELD'
    where rm.room_id = r.id and rm.member_status = 'JOINED'
    order by rm.joined_at, rm.id
  loop
    item_count := item_count + 1;
    if m.held_amount is null or m.confirmation_version is distinct from s.settlement_version
       or m.confirmation_status is distinct from 'CONFIRMED'
       or m.boarded_status not in ('BOARDED', 'NO_SHOW') then
      raise exception 'ROOM_NOT_READY';
    end if;
    expected_share := 0;
    if m.boarded_status = 'BOARDED' then
      expected_share := s.actual_fare / rider_count
        + case when rider_index < s.actual_fare % rider_count then 1 else 0 end;
      rider_index := rider_index + 1;
    end if;
    if expected_share > m.held_amount then raise exception 'FARE_EXCEEDS_RESERVED_CREDIT'; end if;
    if m.boarded is distinct from (m.boarded_status = 'BOARDED')
       or m.share_amount is distinct from expected_share
       or m.deposit_amount is distinct from m.held_amount
       or m.refund_amount is distinct from m.held_amount - expected_share then
      raise exception 'SETTLEMENT_ITEM_MISMATCH';
    end if;
  end loop;
  if item_count < 2 then raise exception 'ROOM_NOT_READY'; end if;
  update public.rooms set status = 'SETTLING'
  where id = r.id and status = 'CONFIRMING';
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  for payout in
    select si.user_id, si.share_amount, si.boarded
    from public.settlement_items si
    where si.settlement_id = s.id order by si.user_id
  loop
    select * into reservation from public.room_credit_reservations
    where room_id = r.id and user_id = payout.user_id and status = 'HELD' for update;
    if not found then raise exception 'RESERVATION_NOT_HELD'; end if;
    select id into wallet_id from public.credit_wallets
    where user_id = payout.user_id and status = 'ACTIVE' for update;
    if not found then raise exception 'ACCOUNT_RESTRICTED'; end if;
    insert into public.credit_ledger
      (wallet_id, user_id, room_id, settlement_id, entry_type, amount, idempotency_key)
    values (wallet_id, payout.user_id, r.id,
      case when payout.boarded then s.id else null end,
      'ROOM_RELEASE', reservation.amount,
      'reservation:' || reservation.id::text || ':release')
    returning id into release_id;
    if payout.boarded then
      insert into public.credit_ledger
        (wallet_id, user_id, room_id, settlement_id, entry_type, amount, idempotency_key)
      values (wallet_id, payout.user_id, r.id, s.id, 'SETTLEMENT_DEBIT',
        -payout.share_amount,
        'settlement:' || s.id::text || ':debit:' || payout.user_id::text);
      update public.room_credit_reservations
      set status = 'CAPTURED', settlement_id = s.id,
          release_ledger_id = release_id, captured_at = now()
      where id = reservation.id and status = 'HELD';
    else
      update public.room_credit_reservations
      set status = 'RELEASED', release_ledger_id = release_id, released_at = now()
      where id = reservation.id and status = 'HELD';
    end if;
    if not found then raise exception 'RESERVATION_NOT_HELD'; end if;
  end loop;
  update public.settlements set status = 'COMPLETED', completed_at = now()
  where id = s.id and status = 'CONFIRMING';
  update public.rooms set status = 'SETTLED'
  where id = r.id and status = 'SETTLING';
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  return private.finish_request(p_request_id, jsonb_build_object(
    'settlement_id', s.id, 'settlement_version', s.settlement_version,
    'settlement_status', 'COMPLETED', 'room_status', 'SETTLED'));
end;
$$;

revoke execute on function private.rebuild_settlement_items(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.report_no_show(uuid,uuid) from public, anon;
revoke execute on function public.submit_fare(uuid,bigint,text,text,uuid) from public, anon;
revoke execute on function public.confirm_settlement(uuid,integer,uuid) from public, anon;
revoke execute on function public.dispute_settlement(uuid,integer,text,uuid) from public, anon;
revoke execute on function public.revise_fare(uuid,bigint,text,text,uuid) from public, anon;
revoke execute on function public.finalize_settlement(uuid,integer,uuid) from public, anon;
grant execute on function public.report_no_show(uuid,uuid) to authenticated;
grant execute on function public.submit_fare(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.confirm_settlement(uuid,integer,uuid) to authenticated;
grant execute on function public.dispute_settlement(uuid,integer,text,uuid) to authenticated;
grant execute on function public.revise_fare(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.finalize_settlement(uuid,integer,uuid) to authenticated;
