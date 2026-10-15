# 테스트 크레딧 RLS 및 쓰기 권한 (2단계)

세 테이블 모두 생성 직후 RLS를 활성화하고 `anon`, `authenticated`, `PUBLIC`의 기존 테이블 권한을 회수한다. 마지막 마이그레이션에서 `authenticated`에 `SELECT`만 다시 부여한다. 정책은 `auth.uid() = user_id`인 본인 행의 조회만 허용한다.

| 테이블 | 로그인 사용자 조회 | 직접 쓰기 |
| --- | --- | --- |
| `credit_wallets` | 자신의 지갑만 | `INSERT/UPDATE/DELETE` 불가 |
| `credit_ledger` | 자신의 원장만 | `INSERT/UPDATE/DELETE` 불가. 원장 수정·삭제는 DB 트리거도 거부 |
| `room_credit_reservations` | 자신의 예치만 | `INSERT/UPDATE/DELETE` 불가 |

익명 사용자는 세 테이블을 읽거나 변경할 수 없다. 같은 방의 다른 참여자에게 예치 상태를 보여주는 정책은 `room_members` 테이블과 그 접근 규칙이 생긴 뒤 별도로 추가한다. 그 전에는 개인별 예치 내역을 공개하지 않는다.

`auth.users` 가입 트리거는 마이그레이션 소유자의 권한으로 빈 TEST 지갑을 만든다. 개발용 seed는 관리자 SQL에서 실행한다. 모바일 앱에는 `service_role` 키를 넣지 않는다. 이 키와 테이블 소유자는 RLS를 우회할 수 있으므로 RPC도 호출자의 신원·대상 방·계정 상태를 함수 내부에서 다시 검증한다. 방·예치·탑승·정산 변경 RPC는 `202610140008_room_credit_rpcs.sql`과 `202610140009_settlement_rpcs.sql`에 구현되어 있으며 일반 사용자 충전 경로는 없다.

예치, 취소 반환, 정산 차감, 준비·FIX 연결은 서버 RPC에서 원자적으로 처리한다. RLS는 조회 범위와 직접 쓰기 차단을 담당하고, 금액·상태·중복 제약은 DB 제약과 트리거가 담당한다. 현재 SQL은 실제 Supabase 프로젝트에 적용되지 않았으므로 테스트 방법은 [수동 DB 검증](db-validation.md)을 따른다.
