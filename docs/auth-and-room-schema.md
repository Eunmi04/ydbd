# 3단계 Auth·프로필·방 스키마

`202610140004_profiles.sql`은 Supabase `auth.users`에 연결된 `profiles`를 만든다. `id`는 Auth 사용자 UUID이며 `nickname`(1~40자), 선택 `email`·`school_name`, `verification_status`(`UNVERIFIED/PENDING/VERIFIED/REJECTED`), `account_status`(`ACTIVE/RESTRICTED/SUSPENDED/CLOSED`), `phone_visibility`(`PRIVATE/CONSENTED`), 생성·수정 시각을 저장한다. 비밀번호와 전화번호 원본은 저장하지 않는다. 가입 트리거가 프로필을 만들고 기존 Auth 사용자는 한 번 채운다. 이메일은 Auth 변경 트리거로 동기화한다. 2단계의 빈 TEST 지갑 생성 트리거도 그대로 유지된다.

`202610140005_rooms_members.sql`은 `rooms`와 `room_members`를 만든다. 방은 `host_id`, 출발·도착 텍스트와 선택 좌표, 미래 `departure_at`, `min_members` 기본 2, `max_members` 2~4, 양의 정수 `estimated_fare`, 상태와 생성·수정 시각을 저장한다. 같은 출발·도착 문자열은 허용하지 않는다. 좌표는 지도 API용 저장 필드일 뿐 GPS 추적·지도 호출은 없다.

방 상태는 `OPEN`, `READY_CHECK`, `FIXED`, `IN_PROGRESS`, `FARE_SUBMITTED`, `CONFIRMING`, `SETTLING`, `DISPUTED`, `SETTLED`, `CANCELLED`다. `CONFIRMING`은 [1단계 상태 전이 문서](state-machine.md)에도 필요한 상태라 3단계 요구 목록에 추가했다. 앱은 OPEN 방 조회·생성·참여뿐 아니라 후속 RPC를 통해 준비·예치·탑승·정산 흐름을 호출한다. `READY_CHECK` 이후 전이와 `ready_started_at`·`ready_deadline_at` 설정은 RPC가 맡는다. 방장은 `OPEN` 방의 정보 수정이나 허용된 취소 RPC를 사용할 수 있으며, `FIXED` 이후 일반 정보 변경은 DB 트리거가 거부한다. HELD 예치가 있는 방의 직접 취소도 거부한다.

참여자는 `(room_id,user_id)`가 유일하고 `role=HOST/MEMBER`, `member_status=JOINED/LEFT/REMOVED`, `ready_status=NOT_READY/READY`, `boarded_status=UNKNOWN/BOARDED/NO_SHOW`를 가진다. 시각 필드는 각 상태와 CHECK로 맞춘다. 방 생성 트리거가 방장 `HOST` 행을 같은 트랜잭션에서 추가한다. 방장 역할은 방의 `host_id`와 같아야 하고 방당 HOST는 하나만 허용한다. 가입 시 방 행을 잠그고 OPEN·미래 출발·정원을 검사하므로 동시 참여로 정원을 초과하지 않는다. 준비·예치·탑승 상태 변경은 직접 테이블 쓰기가 아니라 후속 마이그레이션의 RPC를 통해 실행한다.

기존 `credit_wallets.user_id`는 이미 `auth.users(id)`를 참조한다. 새 마이그레이션은 기존 크레딧 테이블을 다시 만들지 않고 `credit_ledger.room_id`, `room_credit_reservations.room_id`와 예치의 `(room_id,user_id)`에 `NOT VALID` FK를 더한다. 새 행은 방·참여자를 참조해야 한다. 과거 개발 데이터에 임의 UUID가 있을 수 있으므로 기존 행 검증은 후속 데이터 정리 뒤 수행한다. `202610140007_settlements_requests.sql`에서 `settlements`·`settlement_items`와 정산 FK도 추가된다.
