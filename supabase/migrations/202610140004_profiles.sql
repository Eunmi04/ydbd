-- Auth owns credentials. Profiles contain only app-visible account metadata.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nickname text not null check (length(btrim(nickname)) between 1 and 40),
  email text,
  school_name text check (school_name is null or length(btrim(school_name)) between 1 and 100),
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  account_status text not null default 'ACTIVE'
    check (account_status in ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED')),
  phone_visibility text not null default 'PRIVATE'
    check (phone_visibility in ('PRIVATE', 'CONSENTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;

create function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_nickname text;
begin
  requested_nickname := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  insert into public.profiles (id, nickname, email)
  values (
    new.id,
    left(coalesce(requested_nickname, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), '사용자'), 40),
    new.email
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, nickname, email)
select id,
  left(coalesce(nullif(btrim(raw_user_meta_data ->> 'nickname'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''), '사용자'), 40),
  email
from auth.users
on conflict (id) do nothing;

create function public.sync_profile_auth_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email, updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger auth_user_sync_profile_email
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_auth_email();

create function public.touch_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();

revoke execute on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_auth_email() from public, anon, authenticated;
revoke execute on function public.touch_profile_updated_at() from public, anon, authenticated;
