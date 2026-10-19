# 동승·예치·정산 상태 전이 (1단계)

모든 전이는 서버 검증을 거친다. 표에 없는 전이는 `INVALID_STATE_TRANSITION`이다. 아래는 현재 마이그레이션 `001`~`011`의 계약이며 실제 DB 적용은 미검증이다. 상세 조건과 금액 규칙은 [크레딧 운영 규칙](credit-flow.md)을 따른다.

## 방 상태 (`RoomStatus`)

| 현재 | 다음 | 사건 및 조건 |
| --- | --- | --- |
| `OPEN` | `READY_CHECK` | 방장이 최소 인원 충족 후 준비 확인 시작. 준비 대상자를 고정하고 서버 시각으로 30초 기한 설정 |
| `OPEN` | `CANCELLED` | 방장 또는 운영자가 취소. `HELD` 예치 반환 |
| `READY_CHECK` | `FIXED` | 마감 전에 대상자 전원 `READY` + `HELD`, 인원 범위 충족 |
| `READY_CHECK` | `CANCELLED` | 준비 미완료·인원 미달·방장/운영자 취소. `HELD` 예치 반환 |
| `FIXED` | `IN_PROGRESS` | 택시 이용 시작 |
| `FIXED` | `CANCELLED` | 이용 시작 전 방장 또는 운영자가 방 전체 취소. `HELD` 예치 반환 |
| `IN_PROGRESS` | `FARE_SUBMITTED` | 확정 참여자 전원이 탑승 또는 미탑승을 신고한 뒤 방장이 실제 요금·증빙 제출 |
| `FARE_SUBMITTED` | `CONFIRMING` | 서버가 동승자에게 현재 버전의 요금 확인 개시 |
| `FARE_SUBMITTED` | `DISPUTED` | 요금·탑승 인원 이의 발생 |
| `CONFIRMING` | `DISPUTED` | 동승자가 이의 제기 |
| `CONFIRMING` | `SETTLING` | 현재 버전 전원 확인, 금액 검증 후 정산 RPC 시작 |
| `SETTLING` | `SETTLED` | 사용자별 원장·예치 처리와 정산 완료. 같은 DB 트랜잭션 내 중간 상태 |
| `DISPUTED` | `CONFIRMING` | 방장이 요금·증빙을 수정하고 확인 재개. 버전 증가, 이전 확인 무효화 |

`CANCELLED`와 `SETTLED`는 최종 상태다. `READY_CHECK`에 들어가면 신규 참여가 끝난다. 자발적 탈퇴 RPC는 이번 범위에 없다. `FIXED` 이후 참여·탈퇴·예치 변경을 금지한다. `IN_PROGRESS` 이후 일반 취소는 없다. `DISPUTED`는 차감·반환을 멈추며 방장이 요금·증빙을 수정해 새 버전의 확인을 받아야 한다.

## 참여자 상태 (`room_members`의 세 필드)

실제 DB는 단일 상태값 대신 `member_status=JOINED`, `ready_status=NOT_READY|READY`, `boarded_status=UNKNOWN|BOARDED|NO_SHOW`를 조합한다. 방 취소 시에도 참여 행은 감사 기록으로 남는다. 다음 표의 기존 합성 상태는 화면 설명용이며 DB enum이 아니다.

| 현재 | 다음 | 사건 및 조건 |
| --- | --- | --- |
| `JOINED` | `READY` | 기한 내 준비 요청 및 `HELD` 예치 성공 |
| `JOINED` | `CANCELLED` | `OPEN`에서 자발적 탈퇴 또는 방 전체 취소 |
| `READY` | `CONFIRMED` | 대상자 전원 조건 충족으로 방 FIX |
| `READY` | `CANCELLED` | 방 전체 취소 또는 준비 확인 만료 |
| `CONFIRMED` | `BOARDED` | 실제 탑승 확인 |
| `CONFIRMED` | `CANCELLED` | `FIXED` 방을 이용 시작 전에 전체 취소 |
| `CONFIRMED` | `DISPUTED` | 요금·탑승 인원 이의로 보류 |
| `BOARDED` | `DISPUTED` | 요금 또는 탑승 인원 이의 제기 |
| `DISPUTED` | `CONFIRMED` | 운영자 검토 후 탑승 확인을 다시 받아야 하는 경우 |
| `DISPUTED` | `BOARDED` | 운영자 검토 후 기존 탑승 확인이 유효한 경우 |
| `BOARDED` | `SETTLED` | 해당 참여자의 정산 원장 처리 완료 |

`CANCELLED`와 `SETTLED`는 참여자의 최종 상태다. `DISPUTED`에서 복귀하더라도 요금 확인은 새 `settlement_version`에서 다시 받는다.

## 예치 상태 (`ReservationStatus`)

| 현재 | 다음 | 사건 및 조건 |
| --- | --- | --- |
| `NONE` | `HELD` | 방 참여자·계정·방 상태·잔액 확인 후 `ROOM_HOLD` 기록 |
| `HELD` | `RELEASED` | 방 또는 참여 취소로 `ROOM_RELEASE` 기록 |
| `HELD` | `CAPTURED` | 정산에서 `ROOM_RELEASE`와 `SETTLEMENT_DEBIT` 기록 완료 |

`NONE`은 예치 행이 없는 조회 상태다. `RELEASED`와 `CAPTURED`는 해당 예치의 최종 상태다. `CAPTURED` 예치에 대해 다시 반환하거나 차감하지 않는다. 새 참여·예치 시도가 필요한 경우 기존 예약을 되살리지 않고 새 예약 생명주기를 사용한다. 단, 같은 방·사용자의 중복 활성 예치는 허용하지 않는다.

## 정산 상태 (`settlements.status`)

실제 저장값은 `DRAFT`, `CONFIRMING`, `DISPUTED`, `COMPLETED`, `CANCELLED`다. `FARE_SUBMITTED`, `SETTLING`, `SETTLED`는 방 상태값이다. 요금 제출 전에는 정산 행이 없다. 아래 표는 개념적 이벤트를 설명한 것이며 실제 DB 전이는 `CONFIRMING → DISPUTED → CONFIRMING(버전 증가)` 또는 `CONFIRMING → COMPLETED`다.

| 현재 | 다음 | 사건 및 조건 |
| --- | --- | --- |
| `NOT_STARTED` | `FARE_SUBMITTED` | 방장이 유효한 요금·증빙 제출 |
| `NOT_STARTED` | `FARE_SUBMITTED` | 미탑승 여부를 포함해 탑승 상태가 모두 확정되어야 함 |
| `FARE_SUBMITTED` | `CONFIRMING` | 현재 버전의 동승자 확인 개시 |
| `FARE_SUBMITTED` | `DISPUTED` | 요금·증빙·인원 이의 |
| `CONFIRMING` | `DISPUTED` | 동승자 이의 제기 |
| `CONFIRMING` | `SETTLED` | 전원 확인 및 원자적 정산 완료 |
| `DISPUTED` | `CONFIRMING` | 검토 후 재확인 개시. 버전 증가·이전 확인 무효화 |

정산의 `COMPLETED`는 최종 상태다. 방이 `CANCELLED`이면 정산을 시작할 수 없다. 미탑승자도 `share=0`, 전액 반환을 확인해야 한다.

## 요금 확인 상태 (`FareConfirmationStatus`)

참여자별·정산 버전별 `PENDING`, `CONFIRMED`, `DISPUTED`를 사용한다. 방장의 요금 제출은 방장 본인의 `CONFIRMED`로 간주한다. 버전이 증가하면 이전 버전의 확인은 정산 조건에 포함하지 않고 새 버전의 방장 확인과 동승자 `PENDING`부터 다시 시작한다.

## 금지 전이의 예

- `OPEN → FIXED`: 준비 대상 고정, 30초 확인, 예치 검증을 건너뛸 수 없다.
- `READY_CHECK → OPEN`: 시작된 준비 확인을 되돌리지 않는다.
- `FIXED → OPEN`, `FIXED → READY_CHECK`: 확정된 참여 구성을 다시 모집하지 않는다.
- `IN_PROGRESS → CANCELLED`: 일반 취소를 허용하지 않는다.
- `HELD → HELD`, `RELEASED → RELEASED`, `CAPTURED → RELEASED`: 중복 예치·반환을 허용하지 않는다. 동일 요청의 재전송은 상태 전이가 아니라 기존 결과 조회로 처리한다.
- `DISPUTED → SETTLED`: 이의 검토와 새 버전의 확인을 건너뛸 수 없다.
