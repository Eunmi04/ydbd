-- No users are verified or credited by this migration.
begin;
alter table public.profiles add column if not exists demo_verification boolean not null default false;
comment on column public.profiles.demo_verification is 'Admin-only demo marker; never evidence of a real identity check.';
revoke update (demo_verification) on public.profiles from public, anon, authenticated;

-- Admin-only backup used by the explicit two-account seed and rollback.
create table if not exists private.demo_profile_backups (
  demo_key text not null,
  user_id uuid not null references auth.users(id),
  original_verification_status text not null,
  original_demo_verification boolean not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  primary key (demo_key, user_id)
);
revoke all on private.demo_profile_backups from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
