# 테스트 크레딧 DB 구조 (2단계)

현재 DB 구현은 `supabase/migrations/`의 순서가 정해진 세 SQL 파일이다. `mobile` 앱은 아직 메모리 기반 시연 코드이며 DB를 호출하지 않는다. 실제 돈, 카드, 계좌, 현금화, 사용자 간 송금은 이 구조에 없다.

## 테이블과 관계

| 테이블 | 목적 | 핵심 컬럼·제약 |
| --- | --- | --- |
| `public.credit_wallets` | 사용자별 TEST 지갑 식별자 | `id` UUID PK, `user_id` UUID unique → `auth.users(id)`, `currency_code='TEST'`, `status`는 `ACTIVE/SUSPENDED/CLOSED`, 생성·수정 시각. `balance` 없음 |
| `public.credit_ledger` | 모든 테스트 크레딧 증감 기록 | `wallet_id, user_id`가 같은 지갑을 가리키는 복합 FK, `amount` bigint 0 금지, 유형별 부호 검사, `(user_id, idempotency_key)` unique, 추가 전용 트리거 |
| `public.room_credit_reservations` | 방별 예치 생명주기 | `room_id`, `user_id`, 양의 `amount`, `HELD/RELEASED/CAPTURED`, 예치·반환 원장 FK, 정산 UUID, 상태별 시각과 필드 검사 |

`credit_ledger.entry_type`은 `TEST_GRANT`, `ROOM_HOLD`, `ROOM_RELEASE`, `SETTLEMENT_DEBIT`, `ADMIN_ADJUSTMENT`만 허용한다. `TEST_GRANT`와 `ROOM_RELEASE`는 양수, `ROOM_HOLD`와 `SETTLEMENT_DEBIT`은 음수다. `ADMIN_ADJUSTMENT`는 사유가 있는 개발 환경 관리 작업에만 사용하며 일반 사용자에게 입력 경로를 만들지 않는다. 원장 행은 수정·삭제할 수 없다.

예약을 `HELD`로 만들 때는 먼저 같은 사용자·방·금액의 `ROOM_HOLD` 원장이 있어야 한다. 종료 시에는 동일 관계의 `ROOM_RELEASE` 원장이 있어야 한다. 트리거가 원장 유형·사용자·방·금액·정산 ID를 검사한다. `RELEASED`는 취소 반환이며 `settlement_id`가 없다. `CAPTURED`는 정산 반환 원장을 `release_ledger_id`로 연결하고 `settlement_id`와 `captured_at`을 기록한다. 종료된 예약은 다시 활성화하거나 삭제할 수 없다.

같은 방·사용자의 `HELD` 예약만 부분 unique 인덱스로 하나로 제한한다. `RELEASED` 후 재참여하면 새 예약 ID와 새 원장 `idempotency_key`를 사용한다. 원장의 예치·반환 키는 각각 `reservation:<reservation_id>:hold`, `reservation:<reservation_id>:release`처럼 예약 시도별로 달라야 한다. 정산 차감 키는 `settlement:<settlement_id>:debit:<user_id>`처럼 정산별로 구분한다. `request_id`의 동일 요청 결과 재생은 별도 `idempotency_requests`가 필요한 후속 단계다.

## 잔액 계산

```sql
-- 이미 ROOM_HOLD 음수 거래를 포함한 사용 가능 크레딧
select coalesce(sum(amount), 0) as available_credit
from public.credit_ledger
where user_id = '<EXISTING_USER_UUID>'::uuid;

-- 현재 예치로 묶인 크레딧
select coalesce(sum(amount), 0) as held_credit
from public.room_credit_reservations
where user_id = '<EXISTING_USER_UUID>'::uuid and status = 'HELD';
```

화면상 총 크레딧은 `available_credit + held_credit`이다. 원장 합계에서 `held_credit`을 다시 빼면 예치가 이중 차감된다. 지갑 테이블에는 잔액을 저장하지 않는다. 위 SQL은 계산 규칙 예시이며, 실제 읽기 RPC는 `202610140011_credit_summary.sql`의 `get_my_credit_summary()`다.

## 의존성과 향후 단계

- `auth.users`는 Supabase Auth가 제공하며 지갑 생성 트리거가 신규 사용자에게 빈 지갑을 만든다. 기존 Auth 사용자도 지갑 생성 마이그레이션에서 채운다. 사용자 삭제는 지갑·원장 보존을 위해 FK가 제한한다.
- `rooms`, `room_members`, `settlements`는 후속 마이그레이션 `005`와 `007`에서 추가된다. `005`와 `007`은 기존 크레딧 테이블의 `room_id`, `settlement_id`에 `NOT VALID` FK를 연결하고, 새 행에는 방·참여자·정산 참조를 검사한다. 과거 개발 데이터가 있는 경우 FK 검증은 데이터 정리 후 별도로 수행한다. 일반 사용자의 크레딧 테이블 직접 쓰기는 계속 차단된다.
- 계정·방 상태, 참여 여부, 예치액, 사용 가능 잔액 검증과 지갑 행 잠금은 `202610140008_room_credit_rpcs.sql` 및 `202610140009_settlement_rpcs.sql`의 서버 RPC가 담당한다. 요청 결과 재생은 `idempotency_requests`로 처리한다. 실제 적용·동시성 검증은 별도 Supabase 환경에서 수행해야 한다.
- `settlements`, `settlement_items`와 테스트용 정산 해시 테이블은 `007`, `010`에서 생성된다. 결제 테이블과 실제 블록체인 연동은 없다.
