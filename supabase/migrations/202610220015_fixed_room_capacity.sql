-- New rooms always have four seats and can start preparation with two people.
-- Existing rooms, reservations and settlements are preserved.
begin;
alter table public.rooms alter column max_members set default 4;
create or replace function public.create_room(
  p_request_id uuid, p_departure_text text, p_destination_text text,
  p_departure_at timestamptz, p_max_members integer, p_estimated_fare bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  previous jsonb;
  created public.rooms%rowtype;
begin
  actor := private.require_active_user();
  -- Keep the old signature compatible; capacity is server-owned from now on.
  previous := private.claim_request(p_request_id, 'create_room', jsonb_build_object(
    'departure', p_departure_text, 'destination', p_destination_text,
    'departure_at', p_departure_at, 'max_members', 4,
    'estimated_fare', p_estimated_fare));
  if previous is not null then return previous; end if;
  insert into public.rooms
    (host_id, departure_text, destination_text, departure_at, min_members, max_members, estimated_fare)
  values (actor, btrim(p_departure_text), btrim(p_destination_text), p_departure_at, 2, 4, p_estimated_fare)
  returning * into created;
  return private.finish_request(p_request_id, jsonb_build_object(
    'room_id', created.id, 'room_status', created.status, 'min_members', 2, 'max_members', 4));
end;
$$;
revoke execute on function public.create_room(uuid,text,text,timestamptz,integer,bigint) from public, anon;
grant execute on function public.create_room(uuid,text,text,timestamptz,integer,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
