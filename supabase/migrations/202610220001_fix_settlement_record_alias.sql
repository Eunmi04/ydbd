CREATE OR REPLACE FUNCTION private.rebuild_settlement_items(
  p_settlement_id uuid,
  p_existing boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.settlements%rowtype;
  m record;
  total_members integer;
  held_members integer;
  unknown_members integer;
  rider_count integer;
  rider_index integer := 0;
  share bigint;
BEGIN
  SELECT *
  INTO STRICT s
  FROM public.settlements
  WHERE id = p_settlement_id;

  SELECT
    count(*),
    count(res.id),
    count(*) FILTER (WHERE member_row.boarded_status = 'UNKNOWN'),
    count(*) FILTER (WHERE member_row.boarded_status = 'BOARDED')
  INTO total_members, held_members, unknown_members, rider_count
  FROM public.room_members AS member_row
  LEFT JOIN public.room_credit_reservations AS res
    ON res.room_id = member_row.room_id
   AND res.user_id = member_row.user_id
   AND res.status = 'HELD'
  WHERE member_row.room_id = s.room_id
    AND member_row.member_status = 'JOINED';

  IF total_members < 2
     OR held_members <> total_members
     OR unknown_members <> 0
     OR rider_count = 0
     OR s.actual_fare < rider_count
  THEN
    RAISE EXCEPTION 'ROOM_NOT_READY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_id = s.room_id
      AND user_id = s.submitted_by
      AND boarded_status = 'BOARDED'
  ) THEN
    RAISE EXCEPTION 'HOST_NOT_BOARDED';
  END IF;

  FOR m IN
    SELECT rm.user_id, rm.boarded_status, r.amount
    FROM public.room_members rm
    JOIN public.room_credit_reservations r
      ON r.room_id = rm.room_id
     AND r.user_id = rm.user_id
     AND r.status = 'HELD'
    WHERE rm.room_id = s.room_id
      AND rm.member_status = 'JOINED'
    ORDER BY rm.joined_at, rm.id
  LOOP
    share := 0;

    IF m.boarded_status = 'BOARDED' THEN
      share := s.actual_fare / rider_count
        + CASE
            WHEN rider_index < s.actual_fare % rider_count THEN 1
            ELSE 0
          END;
      rider_index := rider_index + 1;
    END IF;

    IF share > m.amount THEN
      RAISE EXCEPTION 'FARE_EXCEEDS_RESERVED_CREDIT';
    END IF;

    IF p_existing THEN
      UPDATE public.settlement_items
      SET
        deposit_amount = m.amount,
        share_amount = share,
        refund_amount = m.amount - share,
        boarded = (m.boarded_status = 'BOARDED'),
        confirmation_status =
          CASE WHEN m.user_id = s.submitted_by
               THEN 'CONFIRMED' ELSE 'PENDING' END,
        confirmation_version = s.settlement_version,
        confirmed_at =
          CASE WHEN m.user_id = s.submitted_by
               THEN now() ELSE NULL END,
        dispute_reason = NULL
      WHERE settlement_id = s.id
        AND user_id = m.user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SETTLEMENT_ITEM_MISSING';
      END IF;
    ELSE
      INSERT INTO public.settlement_items (
        settlement_id,
        user_id,
        deposit_amount,
        share_amount,
        refund_amount,
        boarded,
        confirmation_status,
        confirmation_version,
        confirmed_at
      )
      VALUES (
        s.id,
        m.user_id,
        m.amount,
        share,
        m.amount - share,
        m.boarded_status = 'BOARDED',
        CASE WHEN m.user_id = s.submitted_by
             THEN 'CONFIRMED' ELSE 'PENDING' END,
        s.settlement_version,
        CASE WHEN m.user_id = s.submitted_by
             THEN now() ELSE NULL END
      );
    END IF;
  END LOOP;

  RETURN total_members;
END;
$$;