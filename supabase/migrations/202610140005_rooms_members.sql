create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete restrict,
  departure_text text not null check (length(btrim(departure_text)) between 1 and 200),
  destination_text text not null check (length(btrim(destination_text)) between 1 and 200),
  departure_lat numeric check (departure_lat between -90 and 90),
  departure_lng numeric check (departure_lng between -180 and 180),
  destination_lat numeric check (destination_lat between -90 and 90),
  destination_lng numeric check (destination_lng between -180 and 180),
  departure_at timestamptz not null,
  min_members integer not null default 2 check (min_members between 2 and 4),
  max_members integer not null check (max_members between 2 and 4),
  estimated_fare bigint not null check (estimated_fare > 0),
  status text not null default 'OPEN' check (status in (
    'OPEN', 'READY_CHECK', 'FIXED', 'IN_PROGRESS', 'FARE_SUBMITTED',
    'CONFIRMING', 'SETTLING', 'DISPUTED', 'SETTLED', 'CANCELLED'
  )),
  ready_started_at timestamptz,
  ready_deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_distinct_route_check
    check (lower(btrim(departure_text)) <> lower(btrim(destination_text))),
  constraint rooms_capacity_check check (min_members <= max_members),
  constraint rooms_ready_times_check check (
    (ready_started_at is null and ready_deadline_at is null)
    or (ready_started_at is not null and ready_deadline_at > ready_started_at)
  )
);

alter table public.rooms enable row level security;
revoke all on public.rooms from public, anon, authenticated;

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null default 'MEMBER' check (role in ('HOST', 'MEMBER')),
  member_status text not null default 'JOINED'
    check (member_status in ('JOINED', 'LEFT', 'REMOVED')),
  ready_status text not null default 'NOT_READY'
    check (ready_status in ('NOT_READY', 'READY')),
  boarded_status text not null default 'UNKNOWN'
    check (boarded_status in ('UNKNOWN', 'BOARDED', 'NO_SHOW')),
  joined_at timestamptz not null default now(),
  ready_at timestamptz,
  boarded_at timestamptz,
  left_at timestamptz,
  constraint room_members_room_user_key unique (room_id, user_id),
  constraint room_members_ready_fields_check
    check ((ready_status = 'NOT_READY' and ready_at is null)
      or (ready_status = 'READY' and ready_at is not null)),
  constraint room_members_boarded_fields_check
    check ((boarded_status = 'UNKNOWN' and boarded_at is null)
      or (boarded_status <> 'UNKNOWN' and boarded_at is not null)),
  constraint room_members_left_fields_check
    check ((member_status = 'JOINED' and left_at is null)
      or (member_status <> 'JOINED' and left_at is not null))
);

alter table public.room_members enable row level security;
revoke all on public.room_members from public, anon, authenticated;

create unique index room_members_one_host_idx
  on public.room_members (room_id) where role = 'HOST';
create index rooms_status_departure_idx on public.rooms (status, departure_at);
create index rooms_host_idx on public.rooms (host_id, created_at desc);
create index room_members_room_idx on public.room_members (room_id);
create index room_members_user_idx on public.room_members (user_id, joined_at desc);

-- Only OPEN rooms can be edited directly. Later state transitions need server RPCs.
create function public.guard_room_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  joined_count integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' or new.departure_at <= now()
       or new.ready_started_at is not null or new.ready_deadline_at is not null then
      raise exception 'new room must be OPEN with a future departure';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'OPEN' or new.status not in ('OPEN', 'CANCELLED') then
      raise exception 'room cannot be edited in this state';
    end if;
    if (new.id, new.host_id, new.created_at, new.min_members,
        new.ready_started_at, new.ready_deadline_at)
       is distinct from
       (old.id, old.host_id, old.created_at, old.min_members,
        old.ready_started_at, old.ready_deadline_at) then
      raise exception 'room identity and readiness fields cannot be edited';
    end if;
    if new.status = 'CANCELLED' then
      if exists (select 1 from public.room_credit_reservations
                 where room_id = new.id and status = 'HELD') then
        raise exception 'room with held credit needs atomic cancellation RPC';
      end if;
      if (new.departure_text, new.destination_text, new.departure_at,
          new.max_members, new.estimated_fare, new.departure_lat,
          new.departure_lng, new.destination_lat, new.destination_lng)
         is distinct from
         (old.departure_text, old.destination_text, old.departure_at,
          old.max_members, old.estimated_fare, old.departure_lat,
          old.departure_lng, old.destination_lat, old.destination_lng) then
        raise exception 'cancelling a room cannot edit its route or fare';
      end if;
    else
      if new.departure_at <= now() then
        raise exception 'departure must be in the future';
      end if;
      select count(*) into joined_count from public.room_members
      where room_id = new.id and member_status = 'JOINED';
      if joined_count > new.max_members then
        raise exception 'room capacity is below joined member count';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger rooms_guard before insert or update on public.rooms
for each row execute function public.guard_room_write();

-- Host membership is inserted in the same transaction as the room.
create function public.add_room_host_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.host_id, 'HOST');
  return new;
end;
$$;

create trigger rooms_add_host after insert on public.rooms
for each row execute function public.add_room_host_member();

create function public.guard_room_member_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_room public.rooms%rowtype;
  joined_count integer;
begin
  select * into target_room from public.rooms where id = new.room_id for update;
  if not found then
    raise exception 'room not found';
  end if;
  if (new.role = 'HOST') <> (new.user_id = target_room.host_id) then
    raise exception 'host membership must match rooms.host_id';
  end if;
  if new.role = 'MEMBER' then
    if target_room.status <> 'OPEN' or target_room.departure_at <= now() then
      raise exception 'room is not open for joining';
    end if;
    select count(*) into joined_count from public.room_members
    where room_id = new.room_id and member_status = 'JOINED';
    if joined_count >= target_room.max_members then
      raise exception 'room is full';
    end if;
  end if;
  if new.member_status <> 'JOINED' or new.ready_status <> 'NOT_READY'
     or new.boarded_status <> 'UNKNOWN' or new.ready_at is not null
     or new.boarded_at is not null or new.left_at is not null then
    raise exception 'new member must start as JOINED and not ready';
  end if;
  return new;
end;
$$;

create trigger room_members_guard_insert before insert on public.room_members
for each row execute function public.guard_room_member_insert();

create function public.guard_room_member_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'HOST' then
      raise exception 'room host membership cannot be deleted';
    end if;
    return old;
  end if;
  if (new.id, new.room_id, new.user_id, new.role, new.joined_at)
     is distinct from
     (old.id, old.room_id, old.user_id, old.role, old.joined_at) then
    raise exception 'room member identity and role cannot be changed';
  end if;
  if old.role = 'HOST' and new.member_status <> 'JOINED' then
    raise exception 'room host cannot leave its membership';
  end if;
  return new;
end;
$$;

create trigger room_members_guard_change before update or delete on public.room_members
for each row execute function public.guard_room_member_change();

-- New references are checked now; older phase-2 test rows may need cleanup
-- before the NOT VALID foreign keys can be validated in a later migration.
alter table public.credit_ledger add constraint credit_ledger_room_fkey
  foreign key (room_id) references public.rooms (id) on delete restrict not valid;
alter table public.room_credit_reservations add constraint reservations_room_fkey
  foreign key (room_id) references public.rooms (id) on delete restrict not valid;
alter table public.room_credit_reservations add constraint reservations_member_fkey
  foreign key (room_id, user_id) references public.room_members (room_id, user_id)
  on delete restrict not valid;

revoke execute on function public.guard_room_write() from public, anon, authenticated;
revoke execute on function public.add_room_host_member() from public, anon, authenticated;
revoke execute on function public.guard_room_member_insert() from public, anon, authenticated;
revoke execute on function public.guard_room_member_change() from public, anon, authenticated;
