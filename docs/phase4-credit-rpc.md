# 4단계: 준비·예치·반환 RPC

## 파일

- `supabase/migrations/202610140007_settlements_requests.sql`: `(user_id, request_id)` 요청 결과 저장. 동일 작업·입력 재전송은 같은 JSON 응답, 다른 입력은 `REQUEST_ALREADY_PROCESSED`.
- `supabase/migrations/202610140008_room_credit_rpcs.sql`: 방 생성·참여, 30초 준비, 예치, 만료·방 취소·반환, 탑승/미탑승 RPC. 기존 방·참여 직접 쓰기 권한을 회수한다.
- `supabase/migrations/202610140011_credit_summary.sql`: 본인 원장의 합계와 활성 예치 합계를 읽는 RPC. `balance` 컬럼은 없다.
- `mobile/src/services/capstoneApi.ts`: 요청별 UUID를 생성하고, 미확정 통신 오류 때 같은 ID로 재시도할 수 있도록 기기에 저장한다. 저장 키에는 입력 원문 대신 SHA-256 지문을 사용한다.

## 서버 규칙

방 참여에서는 예치하지 않는다. 방장이 `start_ready_check`를 호출하면 참여자 구성이 고정되고 30초 기한이 저장된다. 기한은 서버 시각으로 검증한다. 각 참여자의 `prepare_member`는 방→본인 지갑 행을 잠그고 원장 합계가 충분한지 확인한 뒤 `ROOM_HOLD`와 `HELD` 예약·`READY`를 같은 트랜잭션에 만든다. 마지막 준비는 `FIXED`까지 같은 트랜잭션이다. 기한 만료·방 취소는 `HELD`만 선택해 `ROOM_RELEASE`와 `RELEASED`, 방 `CANCELLED`를 함께 반영한다.

예치액은 `max(5000, ceil(estimated_fare/max_members/1000)*1000)` TEST 크레딧이다. seed 5,000으로 시연하려면 예상 요금이 이 예치액을 초과해 올리지 않는지 확인해야 한다. `available_credit=sum(credit_ledger.amount)`, `held_credit=sum(HELD reservation.amount)`, `total_credit=available+held`다. `ROOM_HOLD`가 이미 음수 원장 행이므로 두 번 빼지 않는다.

## 보안·한계

일반 사용자는 지갑·원장·예약을 직접 쓸 수 없다. RPC는 `SECURITY DEFINER`, 고정 `search_path`, `auth.uid()`, 상태 조건, 지갑 잠금과 DB 고유 제약을 쓴다. `private` helper 스키마는 Data API 호출 권한이 없다. 계정이 `ACTIVE`, 준비·정산 참여는 `VERIFIED`여야 한다. Auth 직접 쓰기나 관리자 대시보드는 없다. 실서비스의 본인확인 절차는 별도 과제다.

현재 마이그레이션은 SQL 파일만 작성됐고 실제 PostgreSQL 적용·동시 요청 검증은 하지 못했다.
