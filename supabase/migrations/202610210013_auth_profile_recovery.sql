-- Preserve existing profiles, status values, room IDs, wallets and RLS policies.
-- Missing profiles can be repaired only for the caller; no privileged inputs.
begin;

create function public.ensure_my_profile()
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  insert into public.profiles (id, nickname, email)
  select u.id,
    left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nickname'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''), '사용자'), 40),
    u.email
  from auth.users u where u.id = caller_id
  on conflict (id) do nothing;

  select * into strict result from public.profiles where id = caller_id;
  return result;
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon, authenticated;
grant execute on function public.ensure_my_profile() to authenticated;

-- Keep only the existing editable columns; status/email/ID are server-owned.
revoke insert, update, delete, truncate, references, trigger on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, school_name, phone_visibility) on public.profiles to authenticated;

commit;
