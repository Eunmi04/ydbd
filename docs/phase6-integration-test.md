# 6단계: 적용·통합 검증 체크리스트

## 현재 검증 경계

이 환경에는 Supabase CLI와 `psql`이 없고 Docker 데몬도 꺼져 있다. Supabase URL·anon key·프로젝트 DB 연결 정보가 제공되지 않아 `001`~`011` SQL은 실제 적용하지 않았다. `npm run typecheck`, `npx eslint src`, Expo 웹 정적 export는 통과했다. 전체 `npm run lint`는 기존 템플릿 파일 `mobile/components/EditScreenInfo.tsx`, `mobile/components/useClientOnlyValue.web.ts`의 두 오류로 실패했다. 아래 다중 사용자·RLS·동시성 시나리오는 **미실행**이다. 앱의 mock 모드 결과는 Supabase 검증으로 간주하지 않는다.

## 실행 준비

1. 별도 테스트 Supabase 프로젝트에서 순서대로 `supabase/migrations/202610140001`~`011` SQL을 적용한다. 실패하면 그 파일부터 원인을 수정하고 다음 파일로 진행하지 않는다. `NOT VALID` 외래키는 기존 phase-2 행을 정리한 뒤 별도로 `VALIDATE CONSTRAINT` 한다.
2. `mobile/.env.example`을 참고해 프로젝트 URL과 publishable/anon 키만 기기 환경에 설정한다. `service_role` 키를 모바일에 두지 않는다.
3. Auth 개발 사용자 A~D를 생성한 뒤 실제 네 UUID를 `supabase/seed/credit_test_users.sql`에 넣어 수동 실행한다. `auth.users`, `profiles`, `credit_wallets`, 사용자별 `TEST_GRANT +5000`을 확인한다. seed를 재실행해도 지급 건수는 그대로여야 한다.
4. 테스트 계정으로 앱을 시작해 `mode=supabase`임을 확인한다. 필요 시 Expo 개발 서버를 재시작해 환경변수 반영을 확인한다.

## 시나리오와 판정

| 번호 | 동작 | 기대 결과 |
| --- | --- | --- |
| 1~3 | A~D 각각 5,000 확인, A 방 생성, B·C 참여 | 방장 포함 3명 JOINED, 참여 시 원장 변동 없음 |
| 4~6 | A 준비 시작, A/B/C 각각 준비 | 30초 기한, 사용자별 HOLD 한 건, 마지막 요청에서 FIXED |
| 7~8 | FIX 후 D 참여, 같은 `p_request_id` 준비 재전송 | D 거절, 동일 준비 응답 재생·중복 HOLD 없음 |
| 9~10 | 별도 방에서 일부만 준비하고 30초 경과, 만료·취소 재호출 | CANCELLED, HELD 건당 RELEASE 1건, 재호출로 중복 없음 |
| 11~13 | 전원 탑승/미탑승 확정, 방장 요금 제출, B 이의, 방장 수정, 전원 재확인 | 이의 중 차감 없음, 버전 증가, 이전 확인 무효 |
| 14~15 | 10,001 크레딧/3명과 예치액 초과 요금 각각 시험 | 첫 탑승 순서에 나머지 1 지급, 초과 요금은 원장 변경 없이 실패 |
| 16~17 | 최종정산 재호출, 같은 계정 준비 동시 요청 2건 | 반환·차감 한 번만; 활성 예치 하나만 |
| 18~20 | A가 B 원장 조회, 앱 재시작, 완료 해시 조회 | B 원장 0행, 세션·DB 상태 유지, 해시 1건 |

각 시나리오는 별도 방 또는 초기화된 테스트 프로젝트에서 실행한다. 30초 제한 때문에 9번은 새 방을 만든다. 원장/예약 조회는 관리자 SQL Editor에서 검증하되, 사용자 RLS는 각 사용자 JWT로 Data API에서 확인한다. 관리자 SQL Editor 조회만으로 RLS 통과를 주장하지 않는다.

검증용 핵심 조회 예시(관리자 SQL Editor, UUID 교체):

```sql
select user_id, sum(amount) as available_credit
from public.credit_ledger where user_id = '<USER_UUID>'::uuid group by user_id;

select room_id, user_id, status, amount, hold_ledger_id, release_ledger_id
from public.room_credit_reservations where room_id = '<ROOM_UUID>'::uuid;

select settlement_id, user_id, entry_type, amount, idempotency_key
from public.credit_ledger where settlement_id = '<SETTLEMENT_UUID>'::uuid
order by user_id, created_at;

select settlement_id, settlement_version, payload_hash
from public.settlement_test_hashes where settlement_id = '<SETTLEMENT_UUID>'::uuid;
```

## 커밋 분리 제안

`feat(db): add settlement schema` → `feat(rpc): add room and credit operations` → `feat(rpc): add settlement finalization` → `feat(wallet): connect ledger balance and history` → `feat(rooms): connect room flow to supabase` → `feat(settlement): connect confirmation and dispute` → `feat(hash): record settlement test hash` → `docs(capstone): document final integration`. 기존 Auth·방 스키마/클라이언트 작업은 별도 `feat(db)`·`feat(auth)` 단위다. 요청이 없어 실제 커밋은 하지 않았다.
