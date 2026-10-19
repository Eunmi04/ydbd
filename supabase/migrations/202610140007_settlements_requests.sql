-- A completed request stores its exact response in the same transaction as the mutation.
create table public.idempotency_requests (
  user_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  operation text not null,
  request_payload jsonb not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.idempotency_requests enable row level security;
revoke all on public.idempotency_requests from public, anon, authenticated;

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms (id) on delete restrict,
  settlement_version integer not null default 1 check (settlement_version >= 1),
  actual_fare bigint not null check (actual_fare > 0),
  submitted_by uuid not null references auth.users (id) on delete restrict,
  evidence_type text check (evidence_type is null or evidence_type in ('SAMPLE', 'REDACTED_URL')),
  evidence_reference text check (evidence_reference is null or length(evidence_reference) <= 500),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'CONFIRMING', 'DISPUTED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  constraint settlements_completed_at_check check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  )
);
alter table public.settlements enable row level security;
revoke all on public.settlements from public, anon, authenticated;
create index settlements_submitter_idx on public.settlements (submitted_by, created_at desc);

create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  deposit_amount bigint not null check (deposit_amount >= 0),
  share_amount bigint not null check (share_amount >= 0),
  refund_amount bigint not null check (refund_amount >= 0),
  boarded boolean not null,
  confirmation_status text not null default 'PENDING'
    check (confirmation_status in ('PENDING', 'CONFIRMED', 'DISPUTED', 'INVALIDATED')),
  confirmation_version integer not null default 1 check (confirmation_version >= 1),
  confirmed_at timestamptz,
  dispute_reason text check (dispute_reason is null or length(dispute_reason) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint settlement_items_one_user_key unique (settlement_id, user_id),
  constraint settlement_items_split_check check (share_amount + refund_amount = deposit_amount),
  constraint settlement_items_no_show_check check (boarded or share_amount = 0),
  constraint settlement_items_confirmation_time_check check (
    (confirmation_status = 'CONFIRMED' and confirmed_at is not null)
    or (confirmation_status <> 'CONFIRMED' and confirmed_at is null)
  )
);
alter table public.settlement_items enable row level security;
revoke all on public.settlement_items from public, anon, authenticated;
create index settlement_items_user_idx on public.settlement_items (user_id, created_at desc);

-- Existing phase-2 development references may be orphans; new references are checked.
alter table public.credit_ledger add constraint credit_ledger_settlement_fkey
  foreign key (settlement_id) references public.settlements (id) on delete restrict not valid;
alter table public.room_credit_reservations add constraint reservations_settlement_fkey
  foreign key (settlement_id) references public.settlements (id) on delete restrict not valid;

grant select on public.settlements to authenticated;
grant select on public.settlement_items to authenticated;
create policy settlements_member_read on public.settlements for select to authenticated
  using (public.is_room_member(room_id) or public.is_room_host(room_id));
create policy settlement_items_own_or_host_read on public.settlement_items for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.settlements s
    where s.id = settlement_id and public.is_room_host(s.room_id)
  ));
