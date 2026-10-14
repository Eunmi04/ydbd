# 테스트 크레딧 DB 수동 검증

현재 저장소에는 Supabase CLI·`psql` 기반 테스트 환경이 없고 Docker 데몬도 실행 중이지 않다. 아래 검증은 개발 Supabase 프로젝트에서 마이그레이션을 적용한 뒤 수행한다. 실제 적용 전에는 성공을 주장하지 않는다. 표의 쓰기 검증은 개발 DB에서 각기 별도의 `begin; ... rollback;` 트랜잭션으로 실행한다. 의도된 오류가 나면 그 트랜잭션을 `rollback;` 한 후 다음 사례를 진행한다.

## 적용·구조 확인

1. 빈 개발 프로젝트에 세 마이그레이션을 파일명 순서대로 적용한다. 새 빈 프로젝트에서 다시 같은 순서로 적용되는지 확인한다. 이미 적용된 마이그레이션 파일을 SQL Editor에서 임의로 재실행하는 것은 재적용 테스트가 아니다.
2. `information_schema.columns`에서 세 테이블의 필수 컬럼을 확인하고 `credit_wallets`에 `balance`가 없음을 확인한다.
3. `pg_indexes`와 `pg_constraint`에서 고유 인덱스, 금액·상태 CHECK, Auth 사용자 및 원장 FK를 확인한다.
4. `pg_class.relrowsecurity`에서 세 테이블 모두 `true`인지 확인한다.

```sql
select c.relname, c.relrowsecurity
from pg_class as c
where c.oid in (
  'public.credit_wallets'::regclass,
  'public.credit_ledger'::regclass,
  'public.room_credit_reservations'::regclass
);
```

## 제약 검증

아래 UUID 자리에는 개발 DB에 이미 존재하는 사용자·지갑 ID를 사용한다. 모든 성공 경로 시험도 `rollback`하여 결과를 남기지 않는다.

| 사례 | 시험 방법 | 예상 결과 |
| --- | --- | --- |
| TEST 외 통화 | 기존 지갑의 `currency_code`를 다른 값으로 변경 | CHECK 오류 |
| 0·방향 오류 | `credit_ledger`에 0, 음수 `TEST_GRANT`, 양수 `ROOM_HOLD`를 각각 입력 | 모두 CHECK 오류 |
| 지갑 사용자 불일치 | A의 `wallet_id`와 B의 `user_id`로 원장 입력 | 복합 FK 오류 |
| 중복 원장 키 | 같은 사용자·`idempotency_key`로 두 건 입력 | 두 번째 unique 오류 |
| 유효 예치 | 같은 사용자·방의 `ROOM_HOLD -5000` 입력 후 금액 5000인 `HELD` 예약 생성 | 성공, 아직 다른 쓰기 없음 |
| 불일치 예치 | 다른 사용자·방·금액 또는 `TEST_GRANT` 원장을 `hold_ledger_id`로 사용 | 예약 트리거 오류 |
| 중복 활성 예치 | 같은 방·사용자의 두 번째 `HELD` 예약 생성 | 부분 unique 오류 |
| 종료 상태 | `HELD`에 맞는 `ROOM_RELEASE +5000`을 연결해 `RELEASED`로 변경한 다음 `HELD`로 되돌리기 | 첫 변경 성공, 역전이는 트리거 오류 |
| 원장 변경 | 기존 원장 행의 `amount` 수정 또는 행 삭제 | 추가 전용 트리거 오류 |
| 재예치 | 첫 예약을 `RELEASED`로 종료한 뒤 새 hold 원장·새 예약 ID·새 키로 같은 방에 다시 예치 | 성공 |

`CAPTURED`는 동일 사용자·방·금액의 `ROOM_RELEASE`, UUID `settlement_id`, `captured_at`을 함께 넣어 `HELD`에서 변경한다. 그 다음 `HELD` 또는 `RELEASED`로 바꾸면 트리거 오류여야 한다. 아직 `settlements` 테이블이 없으므로 이 시험 UUID는 개발 DB에서 검증에만 쓰고 트랜잭션을 롤백한다.

다음은 정상 예치·반환·재예치를 한 번에 시험하는 SQL 예시다. 실제 `auth.users.id`로 자리표시자를 바꾼 후 개발 DB에서만 실행한다. `rollback`으로 모든 시험 데이터를 제거한다.

```sql
begin;
do $test$
declare
  test_user_id uuid := '<EXISTING_USER_UUID>'::uuid;
  test_room_id uuid := gen_random_uuid();
  wallet_uuid uuid;
  reservation_uuid uuid;
  hold_uuid uuid;
  release_uuid uuid;
  attempt integer;
begin
  select id into strict wallet_uuid
  from public.credit_wallets where user_id = test_user_id;

  for attempt in 1..2 loop
    reservation_uuid := gen_random_uuid();
    insert into public.credit_ledger (
      wallet_id, user_id, room_id, entry_type, amount, idempotency_key
    ) values (
      wallet_uuid, test_user_id, test_room_id, 'ROOM_HOLD', -5000,
      'reservation:' || reservation_uuid::text || ':hold'
    ) returning id into hold_uuid;

    insert into public.room_credit_reservations (
      id, room_id, user_id, amount, hold_ledger_id, idempotency_key
    ) values (
      reservation_uuid, test_room_id, test_user_id, 5000, hold_uuid,
      'reservation:' || reservation_uuid::text || ':hold'
    );

    insert into public.credit_ledger (
      wallet_id, user_id, room_id, entry_type, amount, idempotency_key
    ) values (
      wallet_uuid, test_user_id, test_room_id, 'ROOM_RELEASE', 5000,
      'reservation:' || reservation_uuid::text || ':release'
    ) returning id into release_uuid;

    update public.room_credit_reservations
    set status = 'RELEASED', release_ledger_id = release_uuid,
        released_at = now()
    where id = reservation_uuid;
  end loop;
end;
$test$;
rollback;
```

음수 지급 등 실패 시험은 각각 `begin;` 후 해당 입력 한 건을 실행한다. 제약 오류가 예상대로 발생하면 반드시 `rollback;`을 실행하고 다음 시험을 시작한다. 실패 시험에 기존 원장을 수정·삭제하거나 지갑을 변경하는 구문을 사용할 때도 같은 방식으로 롤백한다.

## RLS 검증

실제 개발 계정 A·B로 인증한 클라이언트에서 각각 세 테이블을 조회한다. A는 자기 행만, B는 자기 행만 읽어야 한다. 익명 요청은 행을 읽지 못한다. 각 계정으로 세 테이블에 직접 `INSERT`, `UPDATE`, `DELETE`를 시도하면 권한 오류 또는 RLS 거부가 발생해야 한다. 관리자 SQL Editor는 높은 권한으로 실행되므로 그 결과만으로 RLS를 검증할 수 없다. `service_role` 키는 모바일 테스트 앱에 넣지 않는다.

## 잔액 검증

시드 직후 각 사용자 원장 합계는 5,000이고 `HELD` 합계는 0이다. 5,000 예치 시 원장 합계는 0, `HELD` 합계는 5,000이다. 취소 반환 뒤 원장 합계는 다시 5,000, `HELD` 합계는 0이어야 한다. 정산에서 3,000을 차감한 예시는 원장 `-5,000 +5,000 -3,000`으로 사용 가능 2,000을 만든다. 정산 RPC는 작성되어 있지만 실제 DB 적용 전이므로, 이 수치는 RPC 실행 결과가 아니라 원장 계산 규칙의 예상값이다.
