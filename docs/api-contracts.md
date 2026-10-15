# 팀 간 데이터·요청 계약 (Supabase 구현 초안)

이 문서는 작성된 PostgreSQL RPC의 팀 간 계약이다. 실제 Supabase 프로젝트에 적용·실행한 결과는 아직 없다. 금액은 정수 TEST 크레딧 단위, 시각은 UTC ISO 8601 문자열, ID와 `p_request_id`는 UUID 문자열이다. 변경 요청의 사용자 ID는 `auth.uid()`에서 읽으며 본문에서 받지 않는다. 규칙은 [크레딧 운영 규칙](credit-flow.md), 전이는 [상태 전이](state-machine.md)를 따른다.

## 팀별 제공 데이터

| 제공 담당 | 서버가 읽는 필드 | 계약 및 사용처 |
| --- | --- | --- |
| 정효민 | `user_id`, `account_status`, `verification_status` | `ACTIVE`와 `VERIFIED`만 예치·준비·정산 참여 가능. 그 외는 `ACCOUNT_RESTRICTED`. 전화번호·증명서 원본은 이 도메인에 전달하지 않음 |
| 김정서 | `room_id`, `host_id`, `room_status`, `min_members`, `max_members`, `estimated_fare`, `ready_started_at`, `ready_deadline_at`, 참여자 `user_id`·`member_status` | 예치액은 서버가 `max(5000, ceil(estimated_fare/max_members/1000)*1000)`으로 계산. 준비 시작 시 참여자 집합 고정 |
| 이예빈 | `settlement_id`, `room_id`, `actual_fare`, `settlement_version`, 참여자별 `fare_confirmation_status`, 증빙 참조 | `confirmed_member_ids`는 화면 표시용 후보일 뿐 정산 대상의 권위 있는 입력이 아님. 서버가 FIX 대상·탑승·확인·예치를 다시 조회 |
| 정은미 | 사용자별 `available_credit`, `held_credit`, `reservation_status`, `settlement_item`, 거래 내역 | 김정서에게 준비·예치·FIX 결과를, 이예빈에게 사용자별 분담·반환 및 정산 상태를 제공 |

`account_status`와 `verification_status`의 전체 enum은 정효민 담당에서 정의한다. 이 계약은 허용값 `ACTIVE`, `VERIFIED`만 요구한다. `host_id`는 방장 권한 검증을 위해 필수다.

## 변경 요청 공통 규칙

- 모든 변경 요청은 `request_id`를 받는다. 동일 사용자·ID·작업·입력 지문이면 기존 성공 결과를 재생한다. 동일 ID의 입력이나 작업이 다르면 `REQUEST_ALREADY_PROCESSED`다. 실패한 검증은 거래나 상태 변경을 남기지 않으며 수정 후 새 `request_id`로 재시도한다.
- RPC는 성공 시 JSON 객체를 반환한다. Supabase 클라이언트에서는 `{ data, error }`로 받으며 서버 오류는 PostgreSQL 예외 메시지에 도메인 코드를 담는다. 앱은 `mobile/src/services/capstoneApi.ts`에서 주요 도메인 코드의 사용자 메시지를 매핑한다.
- 준비·예치 `prepare_member`는 금액 입력을 받지 않는다. 최종 정산 `finalize_settlement`은 인원·분담금 입력을 받지 않는다. 방 요금 제출 때의 `actual_fare`만 방장이 보낸다.
- 예치와 준비, 방 취소와 전원 반환, 정산의 사용자별 반환과 차감은 각각 한 원자적 작업이다. 요청 재전송에 의해 응답을 잃어도 데이터가 중복 생성되지 않는다.

## 도메인 요청·응답

| 작업 / 실행 주체 | 요청 필드 | 성공 응답의 `data` | 핵심 검증 |
| --- | --- | --- | --- |
| `create_room` / 사용자 | `p_request_id`, 출발·도착 텍스트, 출발 시각, 최대 인원, 예상 요금 | `room_id`, `room_status` | 활동 계정, 경로·미래 시각·인원·요금 |
| `join_room` / 사용자 | `p_room_id`, `p_request_id` | `room_id`, `member_status` | `OPEN`, 정원 여유, 중복 참여 아님 |
| `start_ready_check` / 방장 | `p_room_id`, `p_request_id` | `room_id`, `room_status`, `ready_started_at`, `ready_deadline_at`, `target_member_ids` | 최소 인원, 활동·인증 계정 |
| `prepare_member` / 참여자 | `p_room_id`, `p_request_id` | `room_id`, `reservation_id`, `reserved_amount`, `member_status`, `room_status` | 마감 전, 지갑 잠금·잔액 확인, 원자적 예치·READY·FIX |
| `expire_ready_check` / 참여자 | `p_room_id`, `p_request_id` | `room_id`, `expired`, `room_status` | 마감 후 HELD 예치 전액 반환과 방 취소 |
| `cancel_room` / 방장 | `p_room_id`, `p_request_id` | `room_id`, `room_status`, `released_count` | `OPEN`, `READY_CHECK`, 이용 전 `FIXED`만 |
| `mark_boarding` / 참여자 | `p_room_id`, `p_request_id` | `boarded_status=BOARDED`, `room_status` | `FIXED` 또는 `IN_PROGRESS` |
| `report_no_show` / 참여자 | `p_room_id`, `p_request_id` | `boarded_status=NO_SHOW`, `room_status` | 본인 미탑승 신고; 최종 정산 전액 반환 대상 |
| `submit_fare` / 방장 | `p_room_id`, `p_actual_fare`, `p_evidence_type`, `p_evidence_reference`, `p_request_id` | `settlement_id`, `settlement_version`, `room_status` | 모든 참여자의 탑승/미탑승 확정, 양의 정수 요금, 샘플·가림 증빙 |
| `confirm_settlement` / 참여자 | `p_settlement_id`, `p_settlement_version`, `p_request_id` | `confirmation_status` | 현재 버전의 본인 항목만 |
| `dispute_settlement` / 참여자 | 위 ID·버전과 `p_reason` | `settlement_status=DISPUTED` | 자동 차감·반환 보류 |
| `revise_fare` / 방장 | 정산 ID, 새 요금·증빙, 요청 ID | 증가한 `settlement_version` | 이의 상태만; 이전 확인 무효화 |
| `finalize_settlement` / 방장 | 정산 ID·버전·요청 ID | `settlement_status=COMPLETED`, `room_status=SETTLED` | 전원 확인, 인원순 나머지 배분, 예치액 한도, 원자적 원장 처리 |

읽기 계약: `get_my_credit_summary()`는 인증된 사용자에게 `{ available_credit, held_credit, total_credit }`를 반환한다. `credit_ledger`와 `room_credit_reservations`의 본인 행, `rooms`/`room_members`/`settlements`/`settlement_items`의 RLS 허용 행은 직접 조회한다. 별도의 목록 RPC는 아직 없다.

## 오류 코드

| 코드 | 발생 조건 |
| --- | --- |
| `AUTH_REQUIRED` | 인증 세션 없음 |
| `ACCOUNT_RESTRICTED` | 이용 가능 계정 또는 인증 상태가 아님 |
| `USER_NOT_MEMBER` | 해당 방의 참여자·준비 대상자가 아님 |
| `ROOM_NOT_OPEN` | 참여·예치가 허용된 방 상태가 아님 |
| `ROOM_ALREADY_FIXED` | 구형 계약의 코드. 현재 RPC는 `ROOM_NOT_OPEN` 또는 `INVALID_STATE_TRANSITION` 사용 |
| `ALREADY_RESERVED` | 동일 방의 별도 활성 예치를 다시 생성하려는 시도 |
| `INSUFFICIENT_CREDIT` | 사용 가능 크레딧이 방 저장 예치 금액보다 적음 |
| `READY_DEADLINE_EXPIRED` | 준비 기한 만료 성공 응답의 `reason` 필드. 오류 예외가 아님 |
| `ROOM_NOT_READY` | 최소 인원, 전원 준비·예치 또는 전원 탑승 조건 미충족 |
| `RESERVATION_NOT_HELD` | 반환·정산 대상 예치가 `HELD`가 아님 |
| `INVALID_STATE_TRANSITION` | 상태 전이표에 없거나 실행 주체가 허용되지 않는 전이 |
| `FARE_EXCEEDS_RESERVED_CREDIT` | 한 명이라도 분담금이 예치금보다 큼 |
| `SETTLEMENT_ALREADY_APPLIED` | 이미 완료한 `settlement_id`를 새 요청으로 재정산 시도 |
| `REQUEST_ALREADY_PROCESSED` | 사용한 `request_id`를 다른 작업·입력으로 재사용 |
| `ROOM_FULL`, `ALREADY_JOINED`, `ALREADY_READY` | 정원 초과, 중복 참여, 중복 준비 |
| `HOST_REQUIRED`, `ROOM_NOT_FOUND`, `SETTLEMENT_NOT_FOUND` | 방장 권한 또는 대상 조회 실패 |
| `EVIDENCE_REQUIRED`, `INVALID_FARE`, `DISPUTE_REASON_REQUIRED` | 요금·증빙·이의 사유가 유효하지 않음 |
| `SETTLEMENT_ITEM_MISMATCH`, `SETTLEMENT_ITEM_MISSING` | 정산 항목과 서버 계산값 불일치 |
| `REQUEST_ID_REQUIRED`, `REQUEST_IN_PROGRESS` | 요청 ID가 없거나 같은 요청이 아직 처리 중임 |
| `USER_NOT_MEMBER_OR_ALREADY_BOARDED`, `USER_NOT_MEMBER_OR_ALREADY_CONFIRMED`, `USER_NOT_MEMBER_OR_ALREADY_REPORTED` | 탑승·정산 확인·미탑승 처리를 현재 사용자가 수행할 수 없음 |
| `HOST_NOT_BOARDED` | 방장의 탑승 확인이 없어 요금 제출을 진행할 수 없음 |

`REQUEST_NOT_CLAIMED`는 RPC 내부 요청 저장 보조 함수의 방어 오류이며 일반 앱 기능에서 정상적으로 반환되면 안 된다. `REQUEST_IN_PROGRESS`를 받은 앱은 같은 요청 ID로 재조회하거나 잠시 후 다시 시도한다. 위 표의 추가 코드는 4·5단계 RPC에서 실제로 발생할 수 있으므로 초기 1단계의 오류 코드 예시보다 우선한다.

동일 요청의 단순 재전송은 오류가 아니라 기존 성공 결과다. 준비 기한 만료는 RPC가 `room_status=CANCELLED`, `reason=READY_DEADLINE_EXPIRED` 성공 응답으로 반환하며 변경을 커밋한다. 나머지 오류는 예외로 반환되어 거래 전체가 롤백된다.

## 향후 공용 타입 예시

앱의 실제 타입은 `mobile/src/types.ts`에 있다. 아래는 서버 상태의 간략 예시이며 앱에 별도 공용 패키지는 없다.

```ts
export type RoomStatus =
  | 'OPEN' | 'READY_CHECK' | 'FIXED' | 'IN_PROGRESS'
  | 'FARE_SUBMITTED' | 'CONFIRMING' | 'SETTLING' | 'SETTLED'
  | 'CANCELLED' | 'DISPUTED';

export type MemberStatus = 'JOINED' | 'LEFT' | 'REMOVED';
export type ReadyStatus = 'NOT_READY' | 'READY';
export type BoardedStatus = 'UNKNOWN' | 'BOARDED' | 'NO_SHOW';

export type ReservationStatus = 'NONE' | 'HELD' | 'RELEASED' | 'CAPTURED';
export type LedgerEntryType =
  | 'TEST_GRANT' | 'ROOM_HOLD' | 'ROOM_RELEASE'
  | 'SETTLEMENT_DEBIT' | 'ADMIN_ADJUSTMENT';
export type SettlementStatus = 'DRAFT' | 'CONFIRMING' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED';
export type FareConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'INVALIDATED';

export type CreditErrorCode =
  | 'AUTH_REQUIRED' | 'ACCOUNT_RESTRICTED' | 'USER_NOT_MEMBER'
  | 'ROOM_NOT_OPEN' | 'ROOM_ALREADY_FIXED' | 'ALREADY_RESERVED'
  | 'INSUFFICIENT_CREDIT' | 'READY_DEADLINE_EXPIRED' | 'ROOM_NOT_READY'
  | 'RESERVATION_NOT_HELD' | 'INVALID_STATE_TRANSITION'
  | 'FARE_EXCEEDS_RESERVED_CREDIT'
  | 'SETTLEMENT_ALREADY_APPLIED' | 'REQUEST_ALREADY_PROCESSED'
  | 'REQUEST_ID_REQUIRED' | 'REQUEST_IN_PROGRESS'
  | 'ROOM_FULL' | 'HOST_REQUIRED' | 'HOST_NOT_BOARDED'
  | 'USER_NOT_MEMBER_OR_ALREADY_BOARDED'
  | 'USER_NOT_MEMBER_OR_ALREADY_CONFIRMED'
  | 'USER_NOT_MEMBER_OR_ALREADY_REPORTED';

export type CreditMutationRequest = { p_request_id: string };
export type CreditSummary = {
  available_credit: number;
  held_credit: number;
  total_credit: number;
};
export type SettlementItemResult = {
  user_id: string;
  reserved_amount: number;
  charge_amount: number;
  refund_amount: number;
};
// Supabase JS wraps an RPC response as { data: T | null, error: PostgrestError | null }.
```

## 기존 시연 코드와의 관계

| 현재 `mobile/src/types.ts` | 새 도메인 계약 | 차이 |
| --- | --- | --- |
| `recruiting` | `OPEN` | 현재는 참여와 동시에 예치; 새 계약은 참여와 준비·예치를 구분 |
| `confirmed` | `FIXED` | 현재는 방장 버튼으로 바로 확정; 새 계약은 30초 준비·전원 예치 확인 후 FIX |
| `settled` | `SETTLED` | 현재는 메모리에서 즉시 정산; 새 계약은 탑승·요금 확인, 이의 처리, 원자적 원장 기록 필요 |

Supabase 모드에서는 거래 원장과 RPC를 사용하고 `charge`는 호출되지 않는다. 환경변수가 없는 경우에만 기존 `balances`, `charge`, `mockService`가 시연용으로 남는다.

## DB 대상

`credit_wallets`, `credit_ledger`, `room_credit_reservations`, `settlements`, `settlement_items`, `idempotency_requests`, `settlement_test_hashes`의 SQL은 작성했다. 실제 Supabase DB에 적용하고 권한·동시성 테스트를 실행해야 한다.
