-- Small SECURITY DEFINER predicates avoid cross-table RLS recursion.
-- They reveal only a boolean and always bind membership to auth.uid().
create function public.is_room_member(target_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members
    where room_id = target_room_id and user_id = (select auth.uid())
      and member_status = 'JOINED'
  );
$$;

create function public.is_room_host(target_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rooms
    where id = target_room_id and host_id = (select auth.uid())
  );
$$;

create function public.is_open_room(target_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rooms
    where id = target_room_id and status = 'OPEN'
  );
$$;

revoke execute on function public.is_room_member(uuid) from public, anon;
revoke execute on function public.is_room_host(uuid) from public, anon;
revoke execute on function public.is_open_room(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.is_open_room(uuid) to authenticated;

grant select on public.profiles to authenticated;
grant update (nickname, school_name, phone_visibility) on public.profiles to authenticated;
create policy profiles_own_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.rooms to authenticated;
grant insert (host_id, departure_text, destination_text, departure_at,
  max_members, estimated_fare, departure_lat, departure_lng,
  destination_lat, destination_lng) on public.rooms to authenticated;
grant update (departure_text, destination_text, departure_at, max_members,
  estimated_fare, departure_lat, departure_lng, destination_lat,
  destination_lng, status) on public.rooms to authenticated;
create policy rooms_read on public.rooms for select to authenticated
  using (status = 'OPEN' or host_id = (select auth.uid())
    or public.is_room_member(id));
create policy rooms_create on public.rooms for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'OPEN'
    and exists (select 1 from public.profiles
      where id = (select auth.uid()) and account_status = 'ACTIVE'));
create policy rooms_host_update on public.rooms for update to authenticated
  using (host_id = (select auth.uid()) and status = 'OPEN')
  with check (host_id = (select auth.uid())
    and status in ('OPEN', 'CANCELLED'));

grant select on public.room_members to authenticated;
grant insert (room_id, user_id) on public.room_members to authenticated;
create policy room_members_read on public.room_members for select to authenticated
  using (public.is_room_host(room_id) or public.is_room_member(room_id));
create policy room_members_join on public.room_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'MEMBER'
    and member_status = 'JOINED' and ready_status = 'NOT_READY'
    and boarded_status = 'UNKNOWN' and public.is_open_room(room_id)
    and exists (select 1 from public.profiles
      where id = (select auth.uid()) and account_status = 'ACTIVE'));
