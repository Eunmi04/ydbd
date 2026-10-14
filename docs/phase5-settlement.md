# 5단계: 탑승·요금 확인·정산·테스트 해시

## 파일과 흐름

`supabase/migrations/202610140007_settlements_requests.sql`의 `settlements`·`settlement_items`, `009_settlement_rpcs.sql`의 요금·확인·이의·수정·최종정산, `010_settlement_test_hash.sql`의 SHA-256 기록이 대상이다. 화면은 `mobile/src/app/ride/[id]/boarding.tsx`, `settlement.tsx`, `result/[id].tsx`에 연결했다.

1. FIX 참여자 전원이 본인의 `BOARDED` 또는 `NO_SHOW`를 표시한다. `UNKNOWN`이 있으면 요금 제출은 실패한다. 미탑승 본인 신고는 시연 정책이다.
2. 방장만 샘플·가림 처리된 증빙 설명과 양의 정수 요금을 제출한다. 실제 파일 저장·결제는 없다. 정산 버전 1을 만들고 방장 항목만 `CONFIRMED`다.
3. 모든 참여자는 본인 항목의 탑승 여부·분담금·반환액을 확인한다. 미탑승자도 확인한다. 이의가 있으면 `DISPUTED`로 전환하여 차감·반환을 보류한다. 방장은 요금·증빙을 수정하고 버전을 올려 나머지 참여자의 확인을 다시 받는다.
4. 서버는 탑승자만 `actual_fare / rider_count`의 몫을 부담시키고 나머지 1씩은 `joined_at, member_id` 순서의 탑승자에게 배분한다. 미탑승자는 분담금 0, 예치 전액 반환이다. 한 명이라도 분담금이 예치금을 초과하면 거래 전에 실패한다.
5. 방장의 최종정산 한 트랜잭션에서 사용자 ID 순으로 지갑을 잠그고 탑승자에게 `ROOM_RELEASE +deposit`, `SETTLEMENT_DEBIT -share`, 미탑승자에게 `ROOM_RELEASE +deposit`을 기록한다. 예약은 각각 `CAPTURED`/`RELEASED`, 정산은 `COMPLETED`, 방은 `SETTLED`가 된다. 완료된 정산의 새 요청은 재처리하지 않는다.
6. 완료 트리거가 정산 ID·버전·방·요금·사용자별 금액·완료 시각을 정규화된 JSONB로 해시하고 `settlement_test_hashes`에 1회 기록한다. 이는 블록체인 거래가 아니라 DB 내 테스트 무결성 표식이다.

## 위험과 남은 정책

미탑승을 본인이 신고하므로 악용 가능성이 있다. 캡스톤에서는 다른 참여자가 요금 확인 화면에서 이의를 제기해 정산을 보류할 수 있지만 실제 서비스용 증빙·운영자 검토는 없다. 원장·정산 항목의 실 DB 원자성, 해시 트리거, RLS는 환경 미제공으로 미검증이다.
