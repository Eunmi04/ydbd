# 3단계: Auth·방 연동

## 구현 파일과 완료 조건

- `supabase/migrations/202610140004_profiles.sql`~`006_profile_room_rls.sql`: Auth 사용자와 프로필, 방, 참여자, RLS. 이전 단계에서 작성됐다.
- `mobile/src/services/supabaseClient.ts`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 모두 있으면 실제 Supabase 모드, 없으면 로컬 mock 모드다. `service_role`을 앱에 넣지 않는다.
- `mobile/src/state/AppContext.tsx`: 이메일 Auth·세션 복원, 프로필·방·참여자 조회. 이번 단계의 방 생성·참여는 직접 테이블 쓰기에서 `create_room`/`join_room` RPC로 변경했다.
- 신규 사용자 지갑·프로필은 Auth 트리거가 빈 행을 만든다. 가입만으로 TEST 크레딧을 지급하지 않는다.

## 적용·확인

`001`~`011` 마이그레이션을 순서대로 적용한 뒤 개발용 Auth 계정 네 개를 만들고 `supabase/seed/credit_test_users.sql`의 실제 UUID 네 개를 넣어 수동 실행한다. 이 seed는 데모 사용자만 `VERIFIED`로 표시하고 각각 5,000 TEST 크레딧을 한 번 지급한다. 운영 환경에서 사용하지 않는다.

앱 로그인→프로필 조회→방 생성→다른 사용자로 참여→방장의 참여자 목록 확인을 검증한다. 공개 `OPEN` 방은 목록에 보이지만 비참여자는 참여자 목록을 읽지 못한다. 실제 DB 미적용으로 이 검증은 아직 실행되지 않았다.

지도 영역은 출발·도착 텍스트를 표시하는 기존 `MapPreview`다. 지도 API 기반 좌표 검색은 이 작업에 포함하지 않았으므로 실제 지도 연동으로 간주하지 않는다.
