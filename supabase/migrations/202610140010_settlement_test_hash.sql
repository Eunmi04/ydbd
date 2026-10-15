-- This is a database SHA-256 audit marker, not an on-chain transaction.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.settlement_test_hashes (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete restrict,
  settlement_version integer not null check (settlement_version >= 1),
  hash_algorithm text not null default 'SHA-256' check (hash_algorithm = 'SHA-256'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint settlement_test_hashes_once_key unique (settlement_id, settlement_version)
);
alter table public.settlement_test_hashes enable row level security;
revoke all on public.settlement_test_hashes from public, anon, authenticated;
grant select on public.settlement_test_hashes to authenticated;
create policy settlement_hash_member_read on public.settlement_test_hashes for select to authenticated
  using (exists (
    select 1 from public.settlements s
    where s.id = settlement_id
      and (public.is_room_member(s.room_id) or public.is_room_host(s.room_id))
  ));

create function public.record_completed_settlement_hash()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized jsonb;
  normalized_items jsonb;
begin
  if new.status <> 'COMPLETED' or old.status = 'COMPLETED' then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', user_id, 'deposit_amount', deposit_amount,
    'share_amount', share_amount, 'refund_amount', refund_amount,
    'boarded', boarded) order by user_id), '[]'::jsonb)
  into normalized_items
  from public.settlement_items where settlement_id = new.id;
  normalized := jsonb_build_object(
    'settlement_id', new.id, 'settlement_version', new.settlement_version,
    'room_id', new.room_id, 'actual_fare', new.actual_fare,
    'completed_at_utc', to_char(new.completed_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'settlement_items', normalized_items);
  insert into public.settlement_test_hashes
    (settlement_id, settlement_version, payload_hash)
  values (new.id, new.settlement_version,
    encode(extensions.digest(convert_to(normalized::text, 'UTF8'), 'sha256'), 'hex'))
  on conflict (settlement_id, settlement_version) do nothing;
  return new;
end;
$$;

create trigger settlements_record_test_hash
after update of status on public.settlements
for each row execute function public.record_completed_settlement_hash();
revoke execute on function public.record_completed_settlement_hash() from public, anon, authenticated;
