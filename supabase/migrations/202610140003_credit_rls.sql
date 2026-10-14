-- The app may read only its own TEST-credit records. All writes await the
-- authenticated server-side RPCs in a later phase.
alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.room_credit_reservations enable row level security;

revoke all on table public.credit_wallets from public, anon, authenticated;
revoke all on table public.credit_ledger from public, anon, authenticated;
revoke all on table public.room_credit_reservations from public, anon, authenticated;

grant select on table public.credit_wallets to authenticated;
grant select on table public.credit_ledger to authenticated;
grant select on table public.room_credit_reservations to authenticated;

create policy credit_wallets_owner_select
  on public.credit_wallets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy credit_ledger_owner_select
  on public.credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id);

create policy room_credit_reservations_owner_select
  on public.room_credit_reservations for select to authenticated
  using ((select auth.uid()) = user_id);
