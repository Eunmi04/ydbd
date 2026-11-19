-- Run with the local Supabase database owner after applying migrations.
-- The transaction keeps all fixture users, rooms, and grants out of the database.
begin;

insert into auth.users (id, email, raw_user_meta_data)
select ('10000000-0000-4000-8000-00000000000' || n)::uuid,
  'ride-reuse-test-' || n || '@example.invalid',
  jsonb_build_object('nickname', 'Rider ' || n)
from generate_series(1, 6) n;
update public.profiles set verification_status = 'VERIFIED'
where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');

-- Seed settled history without having to advance the historical room state machine.
alter table public.rooms disable trigger user;
alter table public.room_members disable trigger user;
insert into public.rooms (id, host_id, departure_text, destination_text, departure_at,
  max_members, estimated_fare, status, departure_lat, departure_lng)
select ('20000000-0000-4000-8000-00000000000' || n)::uuid,
  '10000000-0000-4000-8000-000000000001', departure, destination,
  now() - (age || ' days')::interval, 4, 12000, 'SETTLED', latitude, 126.97
from (values (1, 'Station', 'Campus', 1, 37.56), (2, ' station ', 'Campus', 2, 37.51),
  (3, 'Campus', 'Station', 3, 37.50), (4, 'Mall', 'Station', 4, 37.52),
  (5, 'Park', 'Station', 5, 37.53), (6, 'Airport', 'Museum', 0, 37.54))
  as history(n, departure, destination, age, latitude);
insert into public.room_members (room_id, user_id, role, boarded_status, boarded_at)
select r.id, u.id, case when u.id = r.host_id then 'HOST' else 'MEMBER' end,
  case when right(u.id::text, 1) = '4' or right(r.id::text, 1) = '6' then 'NO_SHOW' else 'BOARDED' end,
  r.departure_at
from public.rooms r
join auth.users u on u.id = r.host_id
  or (r.id = '20000000-0000-4000-8000-000000000001'
    and u.id in ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004'))
where left(r.id::text, 8) = '20000000';
alter table public.room_members enable trigger user;
alter table public.rooms enable trigger user;

set local role anon;
do $$
begin
  perform public.get_my_completed_routes();
  raise exception 'anonymous room history read succeeded';
exception when insufficient_privilege then null;
end;
$$;

set local role authenticated;
do $$
declare
  host constant uuid := '10000000-0000-4000-8000-000000000001';
  rider_a constant uuid := '10000000-0000-4000-8000-000000000002';
  rider_b constant uuid := '10000000-0000-4000-8000-000000000003';
  no_show constant uuid := '10000000-0000-4000-8000-000000000004';
  outsider constant uuid := '10000000-0000-4000-8000-000000000005';
  other constant uuid := '10000000-0000-4000-8000-000000000006';
  source constant uuid := '20000000-0000-4000-8000-000000000001';
  recent_ids uuid[];
  request_id uuid := gen_random_uuid();
  target uuid;
  closed_room uuid;
  next_room uuid;
  invite_a uuid;
  invite_b uuid;
  closed_invite uuid;
  result jsonb;
  departure_time timestamptz := now() + interval '2 hours';
begin
  perform set_config('request.jwt.claim.sub', host::text, true);
  select array_agg(room_id order by boarded_at desc) into recent_ids from public.get_my_completed_routes();
  assert recent_ids = array[source, '20000000-0000-4000-8000-000000000003'::uuid,
    '20000000-0000-4000-8000-000000000004'::uuid], 'latest distinct routes and no-show exclusion';
  assert (select departure_lat = 37.56 from public.get_my_completed_routes(source)), 'stored source coordinate';
  assert (select count(*) from public.get_ride_reinvite_candidates(source)) = 0, 'opt-in defaults off';
  assert (public.get_my_credit_summary()->>'available_credit')::bigint = 1000000, 'signup grant';
  assert (select count(*) from public.credit_ledger where entry_type = 'TEST_GRANT') = 1, 'own grant only';
  begin
    update public.credit_ledger set amount = 2000000 where user_id = host;
    raise exception 'client could change grant';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_room_with_coordinates(request_id, 'Station', 'Campus',
      departure_time, 4, 12000, 37.56, null, null, null);
    raise exception 'partial coordinate pair accepted';
  exception when raise_exception then
    if sqlerrm <> 'INVALID_COORDINATES' then raise; end if;
  end;
  result := public.create_room_with_coordinates(request_id, 'Station', 'Campus', departure_time,
    4, 12000, 37.56, 126.97, 37.71, 126.89);
  target := (result->>'room_id')::uuid;
  assert result = public.create_room_with_coordinates(request_id, 'Station', 'Campus', departure_time,
    4, 12000, 37.56, 126.97, 37.71, 126.89), 'coordinate creation is idempotent';
  assert (select departure_lat = 37.56 and destination_lng = 126.89 and max_members = 4
    from public.rooms where id = target), 'coordinates and existing room capacity persisted';

  perform set_config('request.jwt.claim.sub', rider_a::text, true);
  perform public.set_ride_invite_preference(true);
  perform set_config('request.jwt.claim.sub', rider_b::text, true);
  perform public.set_ride_invite_preference(true);
  perform set_config('request.jwt.claim.sub', no_show::text, true);
  perform public.set_ride_invite_preference(true);
  assert (select count(*) from public.get_my_completed_routes(source)) = 0, 'no-show cannot reuse route';
  assert (select count(*) from public.get_ride_reinvite_candidates(source)) = 0, 'no-show cannot see nicknames';
  perform set_config('request.jwt.claim.sub', host::text, true);
  assert (select array_agg(user_id order by user_id) from public.get_ride_reinvite_candidates(source))
    = array[rider_a, rider_b], 'only other boarded opted-in riders';
  perform public.send_ride_invite(target, source, rider_a);
  perform public.send_ride_invite(target, source, rider_a);
  perform public.send_ride_invite(target, source, rider_b);
  assert (select count(*) from public.ride_invites where room_id = target) = 2, 'no duplicate invites';
  assert (select count(*) from public.room_members where room_id = target) = 1, 'invitations do not join';
  select id into invite_a from public.ride_invites where room_id = target and recipient_id = rider_a;
  select id into invite_b from public.ride_invites where room_id = target and recipient_id = rider_b;
  begin
    perform public.respond_to_ride_invite(invite_a, true);
    raise exception 'sender accepted on behalf of recipient';
  exception when raise_exception then
    if sqlerrm <> 'INVITE_UNAVAILABLE' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', outsider::text, true);
  assert (select count(*) from public.ride_invites) = 0, 'unrelated account cannot read invites';
  assert (select count(*) from public.get_my_ride_invites()) = 0, 'unrelated inbox is empty';
  assert (select count(*) from public.get_my_completed_routes(source)) = 0, 'unrelated history is private';
  assert (select count(*) from public.get_ride_reinvite_candidates(source)) = 0, 'unrelated cannot see nicknames';
  perform public.join_room(target, gen_random_uuid());
  perform set_config('request.jwt.claim.sub', other::text, true);
  perform public.join_room(target, gen_random_uuid());
  perform set_config('request.jwt.claim.sub', rider_a::text, true);
  assert public.respond_to_ride_invite(invite_a, true) = target, 'invite joins as recipient';
  assert public.respond_to_ride_invite(invite_a, true) = target, 'acceptance replay';
  assert (select ready_status = 'NOT_READY' and boarded_status = 'UNKNOWN' from public.room_members
    where room_id = target and user_id = rider_a), 'regular readiness and boarding defaults';
  assert (select count(*) from public.room_credit_reservations where room_id = target) = 0, 'no hold on acceptance';
  perform set_config('request.jwt.claim.sub', rider_b::text, true);
  assert (select status from public.get_my_ride_invites() where id = invite_b) = 'FULL', 'full room inbox state';
  begin
    perform public.respond_to_ride_invite(invite_b, true);
    raise exception 'joined full room';
  exception when raise_exception then
    if sqlerrm <> 'ROOM_FULL' then raise; end if;
  end;
  assert public.respond_to_ride_invite(invite_b, false) = target, 'decline is available without joining';

  perform set_config('request.jwt.claim.sub', host::text, true);
  assert public.start_ready_check(target, gen_random_uuid())->>'room_status' = 'READY_CHECK', 'host starts regular READY';
  perform set_config('request.jwt.claim.sub', rider_a::text, true);
  perform public.prepare_member(target, gen_random_uuid());
  assert (public.get_my_credit_summary()->>'held_credit')::bigint > 0, 'accepted rider can hold TEST credits at READY';
  perform set_config('request.jwt.claim.sub', host::text, true);
  perform public.cancel_room(target, gen_random_uuid());
  perform set_config('request.jwt.claim.sub', rider_a::text, true);
  assert (public.get_my_credit_summary()->>'available_credit')::bigint = 1000000, 'room cancellation releases hold';
  perform set_config('request.jwt.claim.sub', host::text, true);
  closed_room := (public.create_room(gen_random_uuid(), 'Station', 'Park', departure_time, 4, 12000)->>'room_id')::uuid;
  perform public.send_ride_invite(closed_room, source, rider_b);
  select id into closed_invite from public.ride_invites where room_id = closed_room;
  perform public.cancel_room(closed_room, gen_random_uuid());
  next_room := (public.create_room(gen_random_uuid(), 'Station', 'Mall', departure_time, 4, 12000)->>'room_id')::uuid;
  perform public.send_ride_invite(next_room, source, rider_b);
  perform set_config('request.jwt.claim.sub', rider_b::text, true);
  assert (select status from public.get_my_ride_invites() where id = closed_invite) = 'CLOSED', 'closed room inbox state';
  begin
    perform public.respond_to_ride_invite(closed_invite, true);
    raise exception 'joined closed room';
  exception when raise_exception then
    if sqlerrm <> 'ROOM_NOT_OPEN' then raise; end if;
  end;
  perform public.set_ride_invite_block(host, true);
  assert (select nickname from public.get_my_ride_invite_blocks()) = 'Rider 1', 'block setting is manageable';
  assert (select count(*) from public.get_my_ride_invites()) = 0, 'blocked sender disappears from inbox';
  perform set_config('request.jwt.claim.sub', host::text, true);
  assert (select count(*) from public.get_ride_reinvite_candidates(source) where user_id = rider_b) = 0, 'block prevents discovery';
  assert (select status from public.ride_invites where room_id = next_room and recipient_id = rider_b) = 'DECLINED',
    'block ends pending invitations';
end;
$$;

reset role;
update public.ride_invites set status = 'PENDING', created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
where recipient_id = '10000000-0000-4000-8000-000000000003'
  and room_id in (select id from public.rooms where destination_text = 'Mall' and status = 'OPEN');
set local role authenticated;
do $$
declare
  recipient constant uuid := '10000000-0000-4000-8000-000000000003';
  sender constant uuid := '10000000-0000-4000-8000-000000000001';
  expired_id uuid;
begin
  perform set_config('request.jwt.claim.sub', recipient::text, true);
  perform public.set_ride_invite_block(sender, false);
  select id into expired_id from public.get_my_ride_invites() where status = 'EXPIRED';
  assert expired_id is not null, 'expired invite is shown as expired';
  begin
    perform public.respond_to_ride_invite(expired_id, true);
    raise exception 'accepted expired invite';
  exception when raise_exception then
    if sqlerrm <> 'INVITE_UNAVAILABLE' then raise; end if;
  end;
  perform public.set_ride_invite_preference(false);
  assert (select not opted_in from public.ride_invite_preferences), 'opt-out saved';
end;
$$;

rollback;
