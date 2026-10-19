-- Capstone-only TEST credits. No monetary balance is stored on a wallet.
create table public.credit_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  currency_code text not null default 'TEST' check (currency_code = 'TEST'),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_wallets_id_user_id_key unique (id, user_id)
);

-- Close the Data API before any later migration grants owner-only reads.
alter table public.credit_wallets enable row level security;
revoke all on table public.credit_wallets from public, anon, authenticated;

create function public.touch_credit_wallet_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger credit_wallets_updated_at
before update on public.credit_wallets
for each row execute function public.touch_credit_wallet_updated_at();

-- Trigger execution uses the migration owner's privileges, not the caller's.
create function public.create_test_credit_wallet_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_create_test_credit_wallet
after insert on auth.users
for each row execute function public.create_test_credit_wallet_for_new_user();

-- A migration may be applied after Auth users have already signed up.
insert into public.credit_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null,
  user_id uuid not null,
  room_id uuid,
  settlement_id uuid,
  entry_type text not null check (entry_type in (
    'TEST_GRANT', 'ROOM_HOLD', 'ROOM_RELEASE',
    'SETTLEMENT_DEBIT', 'ADMIN_ADJUSTMENT'
  )),
  amount bigint not null check (amount <> 0),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint credit_ledger_wallet_owner_fkey
    foreign key (wallet_id, user_id)
    references public.credit_wallets (id, user_id) on delete restrict,
  constraint credit_ledger_amount_direction_check check (
    (entry_type in ('TEST_GRANT', 'ROOM_RELEASE') and amount > 0)
    or (entry_type in ('ROOM_HOLD', 'SETTLEMENT_DEBIT') and amount < 0)
    or (entry_type = 'ADMIN_ADJUSTMENT' and amount <> 0)
  ),
  constraint credit_ledger_user_idempotency_key_key
    unique (user_id, idempotency_key)
);

alter table public.credit_ledger enable row level security;
revoke all on table public.credit_ledger from public, anon, authenticated;

-- Corrections must be new entries; existing entries remain immutable.
create function public.reject_credit_ledger_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit_ledger is append-only';
end;
$$;

create trigger credit_ledger_append_only
before update or delete on public.credit_ledger
for each row execute function public.reject_credit_ledger_change();

create index credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc, id desc);
create index credit_ledger_room_idx
  on public.credit_ledger (room_id) where room_id is not null;
create index credit_ledger_settlement_idx
  on public.credit_ledger (settlement_id) where settlement_id is not null;

-- Trigger functions are not callable through the Data API.
revoke execute on function public.touch_credit_wallet_updated_at() from public, anon, authenticated;
revoke execute on function public.create_test_credit_wallet_for_new_user() from public, anon, authenticated;
revoke execute on function public.reject_credit_ledger_change() from public, anon, authenticated;
