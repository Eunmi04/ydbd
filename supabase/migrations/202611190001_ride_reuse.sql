begin;

create function public.get_my_completed_routes(p_room_id uuid default null)
returns table (room_id uuid, departure text, destination text, boarded_at timestamptz,
  departure_lat numeric, departure_lng numeric, destination_lat numeric, destination_lng numeric)
language sql stable security invoker set search_path = '' as $$
  select route.*
  from (
    select distinct on (lower(btrim(r.departure_text)), lower(btrim(r.destination_text)))
      r.id, r.departure_text, r.destination_text, m.boarded_at,
      r.departure_lat, r.departure_lng, r.destination_lat, r.destination_lng
    from public.rooms r
    join public.room_members m on m.room_id = r.id
    where m.user_id = (select auth.uid()) and m.member_status = 'JOINED'
      and m.boarded_status = 'BOARDED' and r.status = 'SETTLED'
      and (p_room_id is null or r.id = p_room_id)
    order by lower(btrim(r.departure_text)), lower(btrim(r.destination_text)),
      m.boarded_at desc, r.id desc
  ) route
  order by route.boarded_at desc, route.id desc
  limit 3;
$$;

create function public.create_room_with_coordinates(
  p_request_id uuid, p_departure_text text, p_destination_text text,
  p_departure_at timestamptz, p_max_members integer, p_estimated_fare bigint,
  p_departure_lat numeric, p_departure_lng numeric,
  p_destination_lat numeric, p_destination_lng numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  created jsonb;
begin
  perform private.require_active_user();
  if (p_departure_lat is null) <> (p_departure_lng is null)
    or (p_destination_lat is null) <> (p_destination_lng is null) then
    raise exception 'INVALID_COORDINATES';
  end if;
  previous := private.claim_request(p_request_id, 'create_room_with_coordinates',
    jsonb_build_object('departure', p_departure_text, 'destination', p_destination_text,
      'departure_at', p_departure_at, 'estimated_fare', p_estimated_fare,
      'departure_lat', p_departure_lat, 'departure_lng', p_departure_lng,
      'destination_lat', p_destination_lat, 'destination_lng', p_destination_lng));
  if previous is not null then return previous; end if;

  created := public.create_room(gen_random_uuid(), p_departure_text, p_destination_text,
    p_departure_at, p_max_members, p_estimated_fare);
  update public.rooms set departure_lat = p_departure_lat, departure_lng = p_departure_lng,
    destination_lat = p_destination_lat, destination_lng = p_destination_lng
  where id = (created->>'room_id')::uuid;
  return private.finish_request(p_request_id, created);
end;
$$;

create table public.ride_invite_preferences (
  user_id uuid primary key references public.profiles(id),
  opted_in boolean not null default false
);

create table public.ride_invite_blocks (
  user_id uuid not null references public.profiles(id),
  blocked_user_id uuid not null references public.profiles(id),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

create table public.ride_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  source_room_id uuid not null references public.rooms(id),
  sender_id uuid not null references public.profiles(id),
  sender_name text not null,
  recipient_id uuid not null references public.profiles(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (room_id, recipient_id),
  check (sender_id <> recipient_id and room_id <> source_room_id and expires_at > created_at)
);

create index ride_invites_recipient_created_idx on public.ride_invites (recipient_id, created_at desc);
create index ride_invites_sender_idx on public.ride_invites (sender_id);

alter table public.ride_invite_preferences enable row level security;
alter table public.ride_invite_blocks enable row level security;
alter table public.ride_invites enable row level security;
revoke all on public.ride_invite_preferences, public.ride_invite_blocks, public.ride_invites
  from public, anon, authenticated;
grant select on public.ride_invite_preferences, public.ride_invite_blocks, public.ride_invites to authenticated;
create policy ride_invite_preferences_self on public.ride_invite_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy ride_invite_blocks_self on public.ride_invite_blocks for select to authenticated
  using (user_id = (select auth.uid()));
create policy ride_invites_participants on public.ride_invites for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create function private.can_receive_ride_invite(p_sender uuid, p_recipient uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.ride_invite_preferences pref on pref.user_id = p.id and pref.opted_in
    where p.id = p_recipient and p.account_status = 'ACTIVE'
  ) and not exists (
    select 1 from public.ride_invite_blocks b
    where b.user_id = p_recipient and b.blocked_user_id = p_sender
  );
$$;

create function private.shared_completed_ride(p_room uuid, p_first uuid, p_second uuid)
returns boolean language sql stable set search_path = '' as $$
  select p_first <> p_second and exists (
    select 1 from public.rooms r
    join public.room_members a on a.room_id = r.id and a.user_id = p_first
    join public.room_members b on b.room_id = r.id and b.user_id = p_second
    where r.id = p_room and r.status = 'SETTLED'
      and a.member_status = 'JOINED' and a.boarded_status = 'BOARDED'
      and b.member_status = 'JOINED' and b.boarded_status = 'BOARDED'
  );
$$;

create function public.get_ride_reinvite_candidates(p_room_id uuid)
returns table (user_id uuid, nickname text)
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  return query
  select p.id, p.nickname
  from public.room_members m
  join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id and m.user_id <> actor
    and private.shared_completed_ride(p_room_id, actor, m.user_id)
    and private.can_receive_ride_invite(actor, m.user_id)
  order by p.nickname, p.id;
end;
$$;

create function public.set_ride_invite_preference(p_opted_in boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  perform 1 from public.profiles where id = actor for update;
  insert into public.ride_invite_preferences (user_id, opted_in) values (actor, p_opted_in)
    on conflict (user_id) do update set opted_in = excluded.opted_in;
  if not p_opted_in then
    update public.ride_invites set status = 'DECLINED'
    where recipient_id = actor and status = 'PENDING';
  end if;
end;
$$;

create function public.set_ride_invite_block(p_sender_id uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
begin
  perform 1 from public.profiles where id = actor for update;
  if p_blocked then
    if not exists (select 1 from public.ride_invites
        where recipient_id = actor and sender_id = p_sender_id) then
      raise exception 'INVITE_UNAVAILABLE';
    end if;
    insert into public.ride_invite_blocks (user_id, blocked_user_id) values (actor, p_sender_id)
      on conflict do nothing;
    update public.ride_invites set status = 'DECLINED'
    where recipient_id = actor and sender_id = p_sender_id and status = 'PENDING';
  else
    delete from public.ride_invite_blocks where user_id = actor and blocked_user_id = p_sender_id;
  end if;
end;
$$;

create function public.send_ride_invite(p_room_id uuid, p_source_room_id uuid, p_recipient_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
  target public.rooms%rowtype;
begin
  if not private.shared_completed_ride(p_source_room_id, actor, p_recipient_id) then
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  perform 1 from public.profiles where id = p_recipient_id for update;
  select * into target from public.rooms where id = p_room_id and host_id = actor for update;
  if not found then raise exception 'INVITE_UNAVAILABLE'; end if;
  if exists (select 1 from public.ride_invites where room_id = p_room_id
      and recipient_id = p_recipient_id and sender_id = actor and source_room_id = p_source_room_id) then
    return;
  end if;
  if not private.can_receive_ride_invite(actor, p_recipient_id) then
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  if target.status <> 'OPEN' or target.departure_at <= clock_timestamp() then
    raise exception 'ROOM_NOT_OPEN';
  end if;
  if exists (select 1 from public.room_members
      where room_id = target.id and user_id = p_recipient_id) then
    raise exception 'ALREADY_JOINED';
  end if;
  if (select count(*) from public.room_members where room_id = target.id and member_status = 'JOINED')
      >= target.max_members then raise exception 'ROOM_FULL'; end if;
  insert into public.ride_invites (room_id, source_room_id, sender_id, sender_name, recipient_id, expires_at)
  select target.id, p_source_room_id, actor, p.nickname, p_recipient_id,
    least(target.departure_at, clock_timestamp() + interval '24 hours')
  from public.profiles p where p.id = actor
  on conflict (room_id, recipient_id) do nothing;
end;
$$;

create function public.respond_to_ride_invite(p_invite_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_active_user();
  invitation public.ride_invites%rowtype;
  target public.rooms%rowtype;
  joined jsonb;
begin
  perform 1 from public.profiles where id = actor for update;
  select * into invitation from public.ride_invites
    where id = p_invite_id and recipient_id = actor for update;
  if not found then raise exception 'INVITE_UNAVAILABLE'; end if;
  if (p_accept and invitation.status = 'ACCEPTED')
    or (not p_accept and invitation.status = 'DECLINED') then
    return invitation.room_id;
  end if;
  if invitation.status <> 'PENDING' or p_accept is null then raise exception 'INVITE_UNAVAILABLE'; end if;
  if p_accept then
    select * into target from public.rooms where id = invitation.room_id for update;
    if invitation.expires_at <= clock_timestamp()
      or not private.can_receive_ride_invite(invitation.sender_id, actor) then
      raise exception 'INVITE_UNAVAILABLE';
    end if;
    if target.status <> 'OPEN' or target.departure_at <= clock_timestamp() then
      raise exception 'ROOM_NOT_OPEN';
    end if;
    joined := public.join_room(target.id, gen_random_uuid());
    if joined->>'member_status' is distinct from 'JOINED' then raise exception 'ROOM_NOT_OPEN'; end if;
  end if;
  update public.ride_invites set status = case when p_accept then 'ACCEPTED' else 'DECLINED' end
    where id = invitation.id;
  return invitation.room_id;
end;
$$;

create function public.get_my_ride_invites()
returns table (id uuid, room_id uuid, sender_id uuid, sender_name text, departure text, destination text,
  departure_at timestamptz, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select i.id, r.id, i.sender_id, i.sender_name, r.departure_text, r.destination_text,
    r.departure_at, i.expires_at,
    case
      when i.status <> 'PENDING' then i.status
      when exists (select 1 from public.room_members m
          where m.room_id = r.id and m.user_id = i.recipient_id and m.member_status = 'JOINED') then 'JOINED'
      when i.expires_at <= now() then 'EXPIRED'
      when r.status <> 'OPEN' or r.departure_at <= now() then 'CLOSED'
      when (select count(*) from public.room_members m
          where m.room_id = r.id and m.member_status = 'JOINED') >= r.max_members then 'FULL'
      else 'PENDING'
    end
  from public.ride_invites i
  join public.rooms r on r.id = i.room_id
  where i.recipient_id = (select auth.uid())
    and not exists (select 1 from public.ride_invite_blocks b
      where b.user_id = i.recipient_id and b.blocked_user_id = i.sender_id)
  order by i.created_at desc;
$$;

create function public.get_my_ride_invite_blocks()
returns table (blocked_user_id uuid, nickname text)
language sql stable security invoker set search_path = '' as $$
  select b.blocked_user_id, previous.sender_name
  from public.ride_invite_blocks b
  join lateral (
    select i.sender_name from public.ride_invites i
    where i.sender_id = b.blocked_user_id and i.recipient_id = b.user_id
    order by i.created_at desc, i.id desc limit 1
  ) previous on true
  where b.user_id = (select auth.uid())
  order by previous.sender_name, b.blocked_user_id;
$$;

revoke execute on function private.can_receive_ride_invite(uuid,uuid),
  private.shared_completed_ride(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.get_my_completed_routes(uuid),
  public.create_room_with_coordinates(uuid,text,text,timestamptz,integer,bigint,numeric,numeric,numeric,numeric),
  public.get_ride_reinvite_candidates(uuid), public.set_ride_invite_preference(boolean),
  public.set_ride_invite_block(uuid,boolean), public.send_ride_invite(uuid,uuid,uuid),
  public.respond_to_ride_invite(uuid,boolean), public.get_my_ride_invites(),
  public.get_my_ride_invite_blocks() from public, anon, authenticated;
grant execute on function public.get_my_completed_routes(uuid),
  public.create_room_with_coordinates(uuid,text,text,timestamptz,integer,bigint,numeric,numeric,numeric,numeric),
  public.get_ride_reinvite_candidates(uuid), public.set_ride_invite_preference(boolean),
  public.set_ride_invite_block(uuid,boolean), public.send_ride_invite(uuid,uuid,uuid),
  public.respond_to_ride_invite(uuid,boolean), public.get_my_ride_invites(),
  public.get_my_ride_invite_blocks() to authenticated;

notify pgrst, 'reload schema';
commit;
