# 개발용 TEST 크레딧 지급

개발용 SQL은 `supabase/seed/credit_test_users.sql`이다. 기본 Supabase seed 파일인 `supabase/seed.sql`이 아니므로 마이그레이션이나 기본 시드 실행에 자동 포함되지 않는다. 운영 환경에서는 실행하지 않는다.

## 실행 절차

1. 개발 Supabase 프로젝트에 마이그레이션 `001`~`011`을 순서대로 적용한다.
2. Supabase Auth에서 시연용 사용자 A·B·C·D 네 명을 준비한다. 앱의 `u1` 같은 메모리 시연 ID는 UUID가 아니며 사용할 수 없다.
3. 네 사용자의 실제 `auth.users.id`를 확인한다. seed SQL의 `<USER_A_UUID>`부터 `<USER_D_UUID>`까지 네 자리 모두 서로 다른 실제 UUID로 바꾼다. SQL 파일을 운영 프로젝트에 복사하거나 자동 배포 경로에 넣지 않는다.
4. 개발 프로젝트 SQL Editor에서 수정한 SQL을 관리자 권한으로 한 번 실행한다. 스크립트는 네 사용자가 실제로 존재하는지 확인하고 지갑을 준비한 뒤 개발용 학교 인증 상태를 `VERIFIED`로 설정하고 `TEST_GRANT +5,000`을 원장에 기록한다. 이는 실제 학생 인증이 아니다.
5. 결과를 확인한다. 같은 스크립트를 다시 실행해도 `(user_id, idempotency_key)` 제약과 `ON CONFLICT DO NOTHING` 때문에 추가 지급되지 않는다.

```sql
select user_id, entry_type, amount, idempotency_key
from public.credit_ledger
where user_id in (
  '<USER_A_UUID>'::uuid, '<USER_B_UUID>'::uuid,
  '<USER_C_UUID>'::uuid, '<USER_D_UUID>'::uuid
)
  and idempotency_key = 'seed:test-grant:5000:v1'
order by user_id;
```

예상 결과는 서로 다른 사용자 4명에게 `TEST_GRANT` 5,000씩 총 4행이다. 실제 사용자 ID를 알 수 없으므로 이 저장소에는 임의 UUID나 실제 계정 정보를 기록하지 않는다. 지급 내역은 오직 원장으로 남고 지갑의 잔액 컬럼은 없다. 일반 사용자 앱에서 이 seed를 호출하는 API는 만들지 않는다.
