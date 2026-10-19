-- Read-only projection: no stored balance and no client-supplied user id.
create function public.get_my_credit_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  available_amount bigint;
  held_amount bigint;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select coalesce(sum(amount), 0)::bigint into available_amount
  from public.credit_ledger where user_id = actor;
  select coalesce(sum(amount), 0)::bigint into held_amount
  from public.room_credit_reservations where user_id = actor and status = 'HELD';
  return jsonb_build_object(
    'available_credit', available_amount,
    'held_credit', held_amount,
    'total_credit', available_amount + held_amount
  );
end;
$$;

revoke execute on function public.get_my_credit_summary() from public, anon;
grant execute on function public.get_my_credit_summary() to authenticated;
