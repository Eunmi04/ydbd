create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Claiming the same (user, request_id) waits for a concurrent transaction.
-- A failed operation rolls the claim back together with its other changes.
create function private.claim_request(p_request_id uuid, p_operation text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.idempotency_requests%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  insert into public.idempotency_requests (user_id, request_id, operation, request_payload)
  values (actor, p_request_id, p_operation, p_payload)
  on conflict do nothing;
  if found then return null; end if;
  select * into strict previous from public.idempotency_requests
  where user_id = actor and request_id = p_request_id for update;
  if previous.operation <> p_operation or previous.request_payload <> p_payload then
    raise exception 'REQUEST_ALREADY_PROCESSED';
  end if;
  if previous.response is null then raise exception 'REQUEST_IN_PROGRESS'; end if;
  return previous.response;
end;
$$;

create function private.finish_request(p_request_id uuid, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.idempotency_requests set response = p_response
  where user_id = auth.uid() and request_id = p_request_id and response is null;
  if not found then raise exception 'REQUEST_NOT_CLAIMED'; end if;
  return p_response;
end;
$$;

create function private.require_active_user(p_verified boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles
                 where id = actor and account_status = 'ACTIVE'
                   and (not p_verified or verification_status = 'VERIFIED')) then
    raise exception 'ACCOUNT_RESTRICTED';
  end if;
  return actor;
end;
$$;

create function private.reserve_amount(p_fare bigint, p_members integer)
returns bigint language sql immutable set search_path = '' as $$
  select greatest(5000::numeric, ceil(p_fare::numeric / p_members / 1000) * 1000)::bigint;
$$;

-- This state guard supplements RLS: client room writes are revoked below.
create or replace function public.guard_room_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  joined_count integer;
  allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' or new.departure_at <= now()
       or new.ready_started_at is not null or new.ready_deadline_at is not null then
      raise exception 'new room must be OPEN with a future departure';
    end if;
  else
    if (new.id, new.host_id, new.created_at, new.min_members)
       is distinct from (old.id, old.host_id, old.created_at, old.min_members) then
      raise exception 'room identity cannot be edited';
    end if;
    if old.status = new.status then
      if old.status <> 'OPEN' then raise exception 'room is not editable'; end if;
      if new.departure_at <= now() then raise exception 'departure must be in the future'; end if;
      select count(*) into joined_count from public.room_members
      where room_id = new.id and member_status = 'JOINED';
      if joined_count > new.max_members then raise exception 'room capacity is below member count'; end if;
    else
      allowed := (old.status = 'OPEN' and new.status in ('READY_CHECK', 'CANCELLED'))
        or (old.status = 'READY_CHECK' and new.status in ('FIXED', 'CANCELLED'))
        or (old.status = 'FIXED' and new.status in ('IN_PROGRESS', 'CANCELLED'))
        or (old.status = 'IN_PROGRESS' and new.status in ('FARE_SUBMITTED', 'DISPUTED'))
        or (old.status = 'FARE_SUBMITTED' and new.status in ('CONFIRMING', 'DISPUTED'))
        or (old.status = 'CONFIRMING' and new.status in ('SETTLING', 'DISPUTED'))
        or (old.status = 'SETTLING' and new.status in ('SETTLED', 'DISPUTED'))
        or (old.status = 'DISPUTED' and new.status = 'CONFIRMING');
      if not allowed then raise exception 'INVALID_STATE_TRANSITION'; end if;
      if (new.departure_text, new.destination_text, new.departure_at,
          new.max_members, new.estimated_fare, new.departure_lat,
          new.departure_lng, new.destination_lat, new.destination_lng)
         is distinct from
         (old.departure_text, old.destination_text, old.departure_at,
          old.max_members, old.estimated_fare, old.departure_lat,
          old.departure_lng, old.destination_lat, old.destination_lng) then
        raise exception 'route and fare cannot change during a state transition';
      end if;
    end if;
    if old.status = 'OPEN' and new.status = 'READY_CHECK' then
      if new.ready_started_at is null
         or new.ready_deadline_at <> new.ready_started_at + interval '30 seconds' then
        raise exception 'READY_CHECK requires a 30 second deadline';
      end if;
    elsif (new.ready_started_at, new.ready_deadline_at)
          is distinct from (old.ready_started_at, old.ready_deadline_at) then
      raise exception 'ready deadline cannot be edited';
    end if;
    if new.status in ('CANCELLED', 'SETTLED') and exists (
      select 1 from public.room_credit_reservations
      where room_id = new.id and status = 'HELD'
    ) then raise exception 'room still has held credit'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.release_room_holds(p_room_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  item record;
  release_id uuid;
  released integer := 0;
begin
  for item in
    select r.id, r.user_id, r.amount, l.wallet_id
    from public.room_credit_reservations r
    join public.credit_ledger l on l.id = r.hold_ledger_id
    where r.room_id = p_room_id and r.status = 'HELD'
    order by r.user_id for update of r
  loop
    perform 1 from public.credit_wallets where user_id = item.user_id for update;
    insert into public.credit_ledger
      (wallet_id, user_id, room_id, entry_type, amount, idempotency_key)
    values (item.wallet_id, item.user_id, p_room_id, 'ROOM_RELEASE', item.amount,
      'reservation:' || item.id::text || ':release')
    returning id into release_id;
    update public.room_credit_reservations
    set status = 'RELEASED', release_ledger_id = release_id, released_at = now()
    where id = item.id and status = 'HELD';
    if not found then raise exception 'RESERVATION_NOT_HELD'; end if;
    released := released + 1;
  end loop;
  return released;
end;
$$;

-- Caller must hold the room row lock. Return a response instead of raising
-- after expiry so the cancellation and refunds can commit.
create function private.expire_ready_locked(p_room_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  room_row public.rooms%rowtype;
begin
  select * into room_row from public.rooms where id = p_room_id;
  if room_row.status <> 'READY_CHECK' or clock_timestamp() < room_row.ready_deadline_at then
    return false;
  end if;
  perform private.release_room_holds(p_room_id);
  update public.rooms set status = 'CANCELLED'
  where id = p_room_id and status = 'READY_CHECK';
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  return true;
end;
$$;

-- Once RPCs exist, remove phase-3 direct client write privileges.
revoke insert, update, delete on public.rooms from authenticated;
revoke insert, update, delete on public.room_members from authenticated;
-- Phase 3 granted column-level privileges; a table-level REVOKE does not
-- necessarily clear those grants. Remove the exact column grants as well.
revoke insert (host_id, departure_text, destination_text, departure_at,
  max_members, estimated_fare, departure_lat, departure_lng,
  destination_lat, destination_lng) on public.rooms from authenticated;
revoke update (departure_text, destination_text, departure_at, max_members,
  estimated_fare, departure_lat, departure_lng, destination_lat,
  destination_lng, status) on public.rooms from authenticated;
revoke insert (room_id, user_id) on public.room_members from authenticated;

create function public.create_room(
  p_request_id uuid, p_departure_text text, p_destination_text text,
  p_departure_at timestamptz, p_max_members integer, p_estimated_fare bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  created public.rooms%rowtype;
begin
  actor := private.require_active_user();
  previous := private.claim_request(p_request_id, 'create_room', jsonb_build_object(
    'departure', p_departure_text, 'destination', p_destination_text,
    'departure_at', p_departure_at, 'max_members', p_max_members,
    'estimated_fare', p_estimated_fare));
  if previous is not null then return previous; end if;
  insert into public.rooms
    (host_id, departure_text, destination_text, departure_at, max_members, estimated_fare)
  values (actor, btrim(p_departure_text), btrim(p_destination_text),
    p_departure_at, p_max_members, p_estimated_fare)
  returning * into created;
  return private.finish_request(p_request_id,
    jsonb_build_object('room_id', created.id, 'room_status', created.status));
end;
$$;

create function public.join_room(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
  count_joined integer;
begin
  actor := private.require_active_user();
  previous := private.claim_request(p_request_id, 'join_room', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if private.expire_ready_locked(p_room_id) then
    return private.finish_request(p_request_id,
      jsonb_build_object('room_id', p_room_id, 'room_status', 'CANCELLED', 'reason', 'READY_DEADLINE_EXPIRED'));
  end if;
  if room_row.status <> 'OPEN' or room_row.departure_at <= now() then
    raise exception 'ROOM_NOT_OPEN';
  end if;
  if exists (select 1 from public.room_members
             where room_id = p_room_id and user_id = actor) then
    raise exception 'ALREADY_JOINED';
  end if;
  select count(*) into count_joined from public.room_members
  where room_id = p_room_id and member_status = 'JOINED';
  if count_joined >= room_row.max_members then raise exception 'ROOM_FULL'; end if;
  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, actor, 'MEMBER');
  return private.finish_request(p_request_id,
    jsonb_build_object('room_id', p_room_id, 'member_status', 'JOINED'));
end;
$$;

create function public.start_ready_check(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
  target_ids jsonb;
  count_joined integer;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'start_ready_check', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_row.host_id <> actor then raise exception 'HOST_REQUIRED'; end if;
  if room_row.status <> 'OPEN' or room_row.departure_at <= now() then
    raise exception 'ROOM_NOT_OPEN';
  end if;
  select count(*), jsonb_agg(user_id order by joined_at, id)
  into count_joined, target_ids from public.room_members
  where room_id = p_room_id and member_status = 'JOINED';
  if count_joined < room_row.min_members or count_joined > room_row.max_members then
    raise exception 'ROOM_NOT_READY';
  end if;
  update public.rooms
  set status = 'READY_CHECK', ready_started_at = now(),
      ready_deadline_at = now() + interval '30 seconds'
  where id = p_room_id and status = 'OPEN'
  returning * into room_row;
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  return private.finish_request(p_request_id, jsonb_build_object(
    'room_id', p_room_id, 'room_status', room_row.status,
    'ready_started_at', room_row.ready_started_at,
    'ready_deadline_at', room_row.ready_deadline_at,
    'target_member_ids', target_ids));
end;
$$;

create function public.prepare_member(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
  member_row public.room_members%rowtype;
  wallet_row public.credit_wallets%rowtype;
  available bigint;
  required_amount bigint;
  reservation_id uuid := gen_random_uuid();
  hold_id uuid;
  member_count integer;
  ready_count integer;
  held_count integer;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'prepare_member', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if private.expire_ready_locked(p_room_id) then
    return private.finish_request(p_request_id,
      jsonb_build_object('room_id', p_room_id, 'room_status', 'CANCELLED', 'reason', 'READY_DEADLINE_EXPIRED'));
  end if;
  if room_row.status <> 'READY_CHECK' then raise exception 'ROOM_NOT_READY'; end if;
  select * into member_row from public.room_members
  where room_id = p_room_id and user_id = actor and member_status = 'JOINED' for update;
  if not found then raise exception 'USER_NOT_MEMBER'; end if;
  if member_row.ready_status = 'READY' then raise exception 'ALREADY_READY'; end if;
  required_amount := private.reserve_amount(room_row.estimated_fare, room_row.max_members);
  select * into wallet_row from public.credit_wallets where user_id = actor for update;
  if not found or wallet_row.status <> 'ACTIVE' then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select coalesce(sum(amount), 0) into available from public.credit_ledger where user_id = actor;
  if available < required_amount then raise exception 'INSUFFICIENT_CREDIT'; end if;
  if exists (select 1 from public.room_credit_reservations
             where room_id = p_room_id and user_id = actor and status = 'HELD') then
    raise exception 'ALREADY_RESERVED';
  end if;
  insert into public.credit_ledger
    (wallet_id, user_id, room_id, entry_type, amount, idempotency_key)
  values (wallet_row.id, actor, p_room_id, 'ROOM_HOLD', -required_amount,
    'reservation:' || reservation_id::text || ':hold')
  returning id into hold_id;
  insert into public.room_credit_reservations
    (id, room_id, user_id, amount, hold_ledger_id, idempotency_key)
  values (reservation_id, p_room_id, actor, required_amount, hold_id,
    'reservation:' || reservation_id::text || ':hold');
  update public.room_members set ready_status = 'READY', ready_at = now()
  where id = member_row.id and ready_status = 'NOT_READY';
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  select count(*), count(*) filter (where ready_status = 'READY')
  into member_count, ready_count from public.room_members
  where room_id = p_room_id and member_status = 'JOINED';
  if member_count = ready_count then
    select count(*) into held_count from public.room_credit_reservations
    where room_id = p_room_id and status = 'HELD';
    if held_count <> member_count then raise exception 'ROOM_NOT_READY'; end if;
    update public.rooms set status = 'FIXED'
    where id = p_room_id and status = 'READY_CHECK';
    if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  end if;
  return private.finish_request(p_request_id, jsonb_build_object(
    'room_id', p_room_id, 'reservation_id', reservation_id,
    'reserved_amount', required_amount,
    'member_status', 'READY',
    'room_status', case when member_count = ready_count then 'FIXED' else 'READY_CHECK' end));
end;
$$;

create function public.expire_ready_check(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  room_row public.rooms%rowtype;
  expired boolean;
begin
  perform private.require_active_user();
  previous := private.claim_request(p_request_id, 'expire_ready_check', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not (public.is_room_member(p_room_id) or public.is_room_host(p_room_id)) then
    raise exception 'USER_NOT_MEMBER';
  end if;
  expired := private.expire_ready_locked(p_room_id);
  return private.finish_request(p_request_id, jsonb_build_object(
    'room_id', p_room_id, 'expired', expired,
    'room_status', case when expired then 'CANCELLED' else room_row.status end));
end;
$$;

create function public.cancel_room(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
  released integer;
begin
  actor := private.require_active_user();
  previous := private.claim_request(p_request_id, 'cancel_room', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_row.host_id <> actor then raise exception 'HOST_REQUIRED'; end if;
  if room_row.status not in ('OPEN', 'READY_CHECK', 'FIXED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  released := private.release_room_holds(p_room_id);
  update public.rooms set status = 'CANCELLED'
  where id = p_room_id and status = room_row.status;
  if not found then raise exception 'INVALID_STATE_TRANSITION'; end if;
  return private.finish_request(p_request_id, jsonb_build_object(
    'room_id', p_room_id, 'room_status', 'CANCELLED', 'released_count', released));
end;
$$;

create function public.mark_boarding(p_room_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  room_row public.rooms%rowtype;
begin
  actor := private.require_active_user(true);
  previous := private.claim_request(p_request_id, 'mark_boarding', jsonb_build_object('room_id', p_room_id));
  if previous is not null then return previous; end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_row.status not in ('FIXED', 'IN_PROGRESS') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update public.room_members set boarded_status = 'BOARDED', boarded_at = now()
  where room_id = p_room_id and user_id = actor and member_status = 'JOINED'
    and boarded_status = 'UNKNOWN';
  if not found then raise exception 'USER_NOT_MEMBER_OR_ALREADY_BOARDED'; end if;
  if room_row.status = 'FIXED' then
    update public.rooms set status = 'IN_PROGRESS'
    where id = p_room_id and status = 'FIXED';
  end if;
  return private.finish_request(p_request_id,
    jsonb_build_object('room_id', p_room_id, 'boarded_status', 'BOARDED', 'room_status', 'IN_PROGRESS'));
end;
$$;

-- Only these public wrappers are callable through the Data API.
revoke execute on function private.claim_request(uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function private.finish_request(uuid,jsonb) from public, anon, authenticated;
revoke execute on function private.require_active_user(boolean) from public, anon, authenticated;
revoke execute on function private.reserve_amount(bigint,integer) from public, anon, authenticated;
revoke execute on function private.release_room_holds(uuid) from public, anon, authenticated;
revoke execute on function private.expire_ready_locked(uuid) from public, anon, authenticated;
revoke execute on function public.create_room(uuid,text,text,timestamptz,integer,bigint) from public, anon;
revoke execute on function public.join_room(uuid,uuid) from public, anon;
revoke execute on function public.start_ready_check(uuid,uuid) from public, anon;
revoke execute on function public.prepare_member(uuid,uuid) from public, anon;
revoke execute on function public.expire_ready_check(uuid,uuid) from public, anon;
revoke execute on function public.cancel_room(uuid,uuid) from public, anon;
revoke execute on function public.mark_boarding(uuid,uuid) from public, anon;
grant execute on function public.create_room(uuid,text,text,timestamptz,integer,bigint) to authenticated;
grant execute on function public.join_room(uuid,uuid) to authenticated;
grant execute on function public.start_ready_check(uuid,uuid) to authenticated;
grant execute on function public.prepare_member(uuid,uuid) to authenticated;
grant execute on function public.expire_ready_check(uuid,uuid) to authenticated;
grant execute on function public.cancel_room(uuid,uuid) to authenticated;
grant execute on function public.mark_boarding(uuid,uuid) to authenticated;
