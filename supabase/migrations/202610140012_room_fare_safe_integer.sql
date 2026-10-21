-- JavaScript clients transmit bigint fares as numbers. Reject values that
-- cannot round-trip exactly; this is a precision boundary, not a demo cap.
-- Deliberately fail if historical data is outside the boundary. Do not alter it.
do $$
begin
  if exists (
    select 1 from public.rooms
    where estimated_fare > 9007199254740991
  ) then
    raise exception 'rooms.estimated_fare exceeds JavaScript safe integer; review existing rows before applying this migration';
  end if;
end;
$$;

alter table public.rooms
  add constraint rooms_estimated_fare_safe_integer
  check (estimated_fare <= 9007199254740991);
