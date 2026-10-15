# 3단계 프로필·방 접근 정책

세 새 테이블은 생성 직후 RLS를 켜고 익명 접근을 막는다. `service_role` 키는 앱에 넣지 않는다. SQL Editor의 관리자 권한은 RLS를 우회할 수 있어 로그인한 일반 계정으로 정책을 시험해야 한다.

| 테이블 | 로그인 사용자 읽기 | 직접 쓰기 |
| --- | --- | --- |
| `profiles` | 본인 행만 | 본인의 `nickname`, `school_name`, `phone_visibility`만 UPDATE 가능. 인증·계정 상태와 이메일은 직접 변경 불가 |
| `rooms` | `OPEN` 방, 자신이 방장인 방, 현재 참여한 방 | 최종 RPC 마이그레이션 적용 후 직접 `INSERT/UPDATE/DELETE` 불가. `create_room`, `join_room`, 상태별 RPC만 사용 |
| `room_members` | 본인이 방장 또는 현재 참여자인 방의 참여자 행만 | 최종 RPC 마이그레이션 적용 후 직접 `INSERT/UPDATE/DELETE` 불가. 방장·참여 행은 RPC와 방 생성 트리거가 관리 |

참여 전에는 다른 방의 참여자 행을 조회할 수 없고 인원 수를 `?`로 표시한다. 참여한 뒤 목록에서는 UUID·역할·진행 상태만 노출한다. 다른 사용자의 `profiles`는 조회할 수 없으므로 앱은 타 참여자의 이름·이메일 대신 익명 `동승자 N`을 표시한다. 전화번호·증명서 자료는 이 스키마에 없다. 방·참여자 정책의 교차 참조는 Auth 사용자에 묶인 boolean 보조 함수로 처리해 재귀 RLS를 피한다.

방 생성과 참여는 RLS 외에 트리거가 미래 출발·OPEN 상태·정원·방장 일치·초기 상태를 검사한다. 준비·FIX·예치·반환·탑승 상태 변경은 `202610140008_room_credit_rpcs.sql`의 서버 RPC가 담당하며, 해당 마이그레이션에서 방·참여자의 직접 쓰기 권한을 회수한다. `202610140007_settlements_requests.sql` 이후 정산 조회도 참여자·방장 범위로 제한된다. 실제 Supabase 적용 전에는 SQL 동작을 성공으로 간주하지 않는다. `credit_wallets`, `credit_ledger`, `room_credit_reservations`의 본인 조회·직접 쓰기 차단 정책은 [2단계 정책](rls-policy.md)을 따른다.
