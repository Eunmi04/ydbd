# 회원가입·로그인 시연 준비

## 현재 구현과 준비 상태

기본 진입은 로그인 화면이다. Supabase Auth가 이메일·비밀번호와 세션을 관리하고,
가입 시 기존 `auth_user_create_profile` 트리거가 `profiles.id = auth.users.id`로 프로필을 만든다.
방·지갑·정산에서도 같은 UUID를 사용한다. 비밀번호 확인값은 화면 검증에만 쓰며 DB나 로그로 보내지 않는다.
본인 인증은 이번 범위가 아니므로 신규 프로필은 `UNVERIFIED`로 남는다.

2026-10-21 작업 환경에는 Supabase URL·공개 키가 없었다. 실제 프로젝트의 이메일 확인 설정,
SQL 적용 여부, 계정 생성·로그인·접근 정책은 확인하지 못했다. 아래 준비 후 실제 검증이 필요하다.

## Supabase 설정과 SQL 적용 순서

1. 사용할 Supabase 프로젝트가 팀의 공유 프로젝트인지 확인한다.
2. 기존 마이그레이션 적용 이력을 확인한다. 새 DB라면 `supabase/migrations/`의
   `202610140001_*`부터 `202610140012_*`까지 파일명 순서로 SQL Editor에서 실행한다.
   이미 적용한 파일을 다시 실행하거나 기존 테이블을 삭제하지 않는다.
   기존 스키마가 저장소와 다르면 먼저 팀 담당자와 적용 이력을 맞춘다.
3. 새 `202610210013_auth_profile_recovery.sql`을 한 번 적용한다.
   기존 데이터는 유지하고 `ensure_my_profile()` 복구 함수와 프로필 쓰기 권한을 설정한다.
   기존 `006`의 본인 SELECT/UPDATE RLS와 `003`의 크레딧 읽기 전용 정책을 재사용한다.
4. Dashboard의 Authentication → Sign In / Providers에서 Email 제공자와 신규 가입 허용을 확인한다.
   이메일 확인 없이 가입·로그인할 시연 프로젝트는 **Confirm email을 끈다**.
   공유 프로젝트 설정 변경은 팀과 확인한 사용자가 수행한다. 앱과 SQL은 이 설정을 바꾸지 않는다.
   설정이 켜져 있으면 앱은 확인 메일 안내를 표시하고 세션을 임의로 만들지 않는다.
   이전에 생성된 미확인 계정은 이메일 확인을 완료하거나 관리자에게 상태 확인을 요청한다.
   설정 변경 후 시연에는 새로운 이메일로 가입하여 자동 로그인 여부를 확인한다.
5. `mobile/.env`의 기존 지도 키는 유지하고 다음 두 변수를 추가한다.
   값은 프로젝트 Connect/API 설정에서 확인한 프로젝트 URL과 **공개 publishable/anon 키**다.
   서버 비밀키, `sb_secret_...`, `service_role` 키를 사용하지 않는다.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
EXPO_PUBLIC_ENABLE_MOCK_AUTH=false
```

앱이 읽는 파일은 `mobile/.env`다. 저장소 루트 `.env`만 설정해서는 안 된다.
프로젝트 URL은 `https://프로젝트ID.supabase.co` 형식으로 입력한다.
REST API 주소를 복사해 `/rest/v1/`이 붙으면 Auth 요청은 404로 실패하므로 해당 경로를 제거한다.
값을 변경한 뒤 Expo를 완전히 종료하고 다시 실행한다. `.env`는 커밋하지 않는다.
기존 로컬 시연은 Supabase 두 변수가 없고 `EXPO_PUBLIC_ENABLE_MOCK_AUTH=true`일 때만 활성화된다.
설정이 없는 기본 상태에서는 가입·로그인 버튼과 안내를 통해 설정 누락을 알린다.

## 실행

```powershell
cd mobile
npm install
npm start -- --clear
# 웹으로 시연할 경우
npm run web
```

로그인 시연에는 `mobile/route-api` 실행이나 카카오 REST API 키가 필요하지 않다.

## 시연 순서와 수동 검증

1. 로그인 화면 → 회원가입에서 새 이메일·닉네임·6자 이상 비밀번호·비밀번호 확인을 입력한다.
2. 가입 완료 후 자동 로그인되어 홈에 진입하는지 확인한다.
3. Dashboard의 Authentication → Users에 계정이 있고, Table Editor의 `profiles`에
   같은 UUID의 행과 닉네임·이메일이 있는지 확인한다. 인증 상태는 `UNVERIFIED`여야 한다.
4. 마이페이지에서 가입한 이메일·닉네임과 본인 인증 미완료 표시를 확인한다.
5. 앱을 완전히 종료하고 다시 실행한다. 웹에서는 같은 브라우저의 새로고침으로도 확인한다.
   저장된 로그인 세션을 복원하고 본인 정보를 다시 표시하는지 확인한다.
6. 로그아웃하면 로그인 화면으로 이동하고, 뒤로 가기 및 `/my`, `/wallet`, `/room/new`
   직접 접근으로 보호 화면이 열리지 않는지 확인한다.
7. 잘못된 비밀번호로 로그인하여 오류를 확인한 뒤, 올바른 비밀번호로 재로그인한다.
8. 일반 계정 두 개로 아래 선택적 통합 테스트를 실행하여 타인 프로필 조회·수정과
   인증·계정 상태 변경, 원장 직접 쓰기가 차단되는지 검증한다.
   SQL Editor의 관리자 세션은 RLS를 우회하므로 정책 검증에 쓰지 않는다.

홈의 다른 팀 기능이 아직 DB 준비되지 않아 조회에 실패하더라도 인증·본인 프로필 로딩과는 독립적으로 처리한다.
신규 가입은 TEST 크레딧을 지급하거나 본인 인증을 완료하지 않는다.
준비·예치·정산은 기존 계약의 `VERIFIED` 조건을 그대로 적용하므로 이번 로그인 시연과 구분한다.

## 오류와 복구

- 계정이 생성되고 프로필이 없으면 앱이 `ensure_my_profile()`로 본인 행만 복구한다.
  사용자 ID나 상태값을 인자로 받지 않으며 기존 프로필은 덮어쓰지 않는다.
- 프로필 조회·복구에 실패하면 보호 화면 대신 재시도·로그아웃 화면을 제공한다.
  `013` 적용과 DB 연결·RLS를 확인한 뒤 재시도한다. 계정을 다시 만들 필요는 없다.
- Auth 가입 트리거 자체가 실패하면 가입 트랜잭션이 실패할 수 있다.
  Dashboard Auth/DB 로그와 기존 프로필·지갑 트리거를 확인하고 수정 후 가입을 재시도한다.
- 이메일 확인 안내가 나오면 서버 설정을 확인한다. 클라이언트에서 확인 상태를 조작하지 않는다.

## 자동 검증

```powershell
cd mobile
npm run typecheck
npm run lint
node --test tests/authService.test.mjs tests/creditPolicy.test.mjs
```

실제 DB 테스트는 별도의 새 이메일 두 개를 지정한 경우에만 실행한다.
가입 계정은 테스트 후에도 DB에 남으며, 비밀번호는 실행 중 임의 생성하고 출력하지 않는다.
기존 개인 계정을 사용하지 않는다. 아래 이메일 자리에는 사용할 새 이메일을 입력한다.

```powershell
$env:AUTH_TEST_EMAIL_A='새로운-테스트-이메일-A'
$env:AUTH_TEST_EMAIL_B='새로운-테스트-이메일-B'
node --env-file=.env --test tests/auth.integration.test.mjs
```

이 통합 테스트는 실제 Auth 가입, 프로필 저장, 재로그인, 잘못된 비밀번호 거절,
타인 프로필 접근 차단, 서버 소유 상태 변경 차단, 원장 쓰기 차단, 로그아웃 후 조회 차단,
SDK 저장소를 통한 세션 복원을 검사한다. 모바일 앱 재실행과 화면 이동은 위 수동 절차로 별도 확인한다.
환경변수가 없으면 SKIP으로 표시하며 성공한 실제 DB 검증으로 계산하지 않는다.

## 작업 환경에서의 결과

추가 연결 확인: `mobile/.env`의 프로젝트 URL에 잘못 붙어 있던 `/rest/v1/`을 제거한 뒤,
실제 Supabase 테스트 계정 가입·자동 세션 발급·프로필 저장(`UNVERIFIED`)·로그아웃·
잘못된 비밀번호 거절·같은 UUID로 재로그인을 확인했다.
테스트 계정 `auth-check-1792590844583@example.com`은 DB에 남아 있다.
이 확인은 SDK 직접 요청으로 수행했으며 앱 화면·기기 재실행·타인 프로필 RLS는 아직 별도 확인이 필요하다.
아래는 최초 구현 당시 결과다.

- 타입 검사 통과.
- 인증 단위 테스트 5개와 기존 크레딧 테스트 4개 통과.
- 웹 정적 빌드 통과.
- 전체 린트는 기존 `KakaoMap.web.tsx:22`의 effect 내 상태 변경 오류와
  `mockService.ts:252`의 불필요한 표현식 경고가 남아 있다. 이 작업에서는 해당 팀 기능을 수정하지 않았다.
- 실제 DB 통합 테스트는 연결 설정 부재로 실행하지 못했다.
- 실제 기기 세션 복원·마이페이지 표시·로그아웃 후 보호 화면 이동은 아직 수동 확인이 필요하다.

참고: [Supabase 이메일·비밀번호 인증](https://supabase.com/docs/guides/auth/passwords),
[가입 응답과 이메일 확인](https://supabase.com/docs/reference/javascript/auth-signup),
[React Native 세션 저장](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[Expo 보호 경로](https://docs.expo.dev/router/advanced/protected/).
