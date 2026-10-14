create table public.room_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  amount bigint not null check (amount > 0),
  status text not null default 'HELD'
    check (status in ('HELD', 'RELEASED', 'CAPTURED')),
  hold_ledger_id uuid not null unique
    references public.credit_ledger (id) on delete restrict,
  release_ledger_id uuid unique
    references public.credit_ledger (id) on delete restrict,
  settlement_id uuid,
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 1 and 200),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  captured_at timestamptz,
  constraint room_credit_reservations_user_idempotency_key_key
    unique (user_id, idempotency_key),
  constraint room_credit_reservations_state_fields_check check (
    (status = 'HELD' and release_ledger_id is null
      and settlement_id is null and released_at is null and captured_at is null)
    or (status = 'RELEASED' and release_ledger_id is not null
      and settlement_id is null and released_at is not null and captured_at is null)
    or (status = 'CAPTURED' and release_ledger_id is not null
      and settlement_id is not null and released_at is null and captured_at is not null)
  ),
  constraint room_credit_reservations_distinct_ledger_check
    check (release_ledger_id is null or release_ledger_id <> hold_ledger_id)
);

alter table public.room_credit_reservations enable row level security;
revoke all on table public.room_credit_reservations from public, anon, authenticated;

-- Historical RELEASED rows remain; only one current hold is allowed.
create unique index room_credit_reservations_one_held_per_room_user_idx
  on public.room_credit_reservations (room_id, user_id)
  where status = 'HELD';
create index room_credit_reservations_room_idx
  on public.room_credit_reservations (room_id);
create index room_credit_reservations_user_created_idx
  on public.room_credit_reservations (user_id, created_at desc);
create index room_credit_reservations_status_room_idx
  on public.room_credit_reservations (status, room_id);
create index room_credit_reservations_settlement_idx
  on public.room_credit_reservations (settlement_id)
  where settlement_id is not null;

-- This validates the referenced entries without allowing clients to mutate them.
create function public.guard_room_credit_reservation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hold_entry public.credit_ledger%rowtype;
  release_entry public.credit_ledger%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'room_credit_reservations cannot be deleted';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'HELD' then
      raise exception 'new reservation must be HELD';
    end if;
  else
    if old.status <> 'HELD' or new.status not in ('RELEASED', 'CAPTURED') then
      raise exception 'reservation has no allowed state transition';
    end if;
    if (new.id, new.room_id, new.user_id, new.amount,
        new.hold_ledger_id, new.idempotency_key, new.created_at)
       is distinct from
       (old.id, old.room_id, old.user_id, old.amount,
        old.hold_ledger_id, old.idempotency_key, old.created_at) then
      raise exception 'reservation identity and hold cannot be changed';
    end if;
  end if;

  select * into hold_entry
  from public.credit_ledger
  where id = new.hold_ledger_id;
  if not found or hold_entry.entry_type <> 'ROOM_HOLD'
     or hold_entry.user_id <> new.user_id
     or hold_entry.room_id is distinct from new.room_id
     or hold_entry.settlement_id is not null
     or hold_entry.amount <> -new.amount then
    raise exception 'hold ledger entry does not match reservation';
  end if;

  if new.release_ledger_id is not null then
    select * into release_entry
    from public.credit_ledger
    where id = new.release_ledger_id;
    if not found or release_entry.entry_type <> 'ROOM_RELEASE'
       or release_entry.user_id <> new.user_id
       or release_entry.room_id is distinct from new.room_id
       or release_entry.settlement_id is distinct from new.settlement_id
       or release_entry.amount <> new.amount then
      raise exception 'release ledger entry does not match reservation';
    end if;
  end if;

  return new;
end;
$$;

create trigger room_credit_reservations_guard
before insert or update or delete on public.room_credit_reservations
for each row execute function public.guard_room_credit_reservation();

revoke execute on function public.guard_room_credit_reservation() from public, anon, authenticated;
