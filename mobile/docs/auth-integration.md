# 회원·인증 통합 PR 안내

## 현재 구성

feature/login에 origin/main의 방·지도·지갑·정산 및 Supabase 코드(2026-10-15 기준)를 병합했습니다. 기존 migrations 001~011과 RPC를 그대로 사용합니다.

- AuthProvider가 회원·학교 인증·정지 상태를 관리하고 AppProvider에 접근 허용된 사용자 ID를 전달합니다.
- useApp의 방·지갑·정산 함수와 mode, isAuthenticated, isLoading 인터페이스는 유지합니다. login/register는 useAuth로 이동했습니다.
- 사용자 변경·로그아웃·둘러보기 종료 시 AppProvider를 새로 생성해 이전 사용자 데이터가 섞이지 않도록 합니다.
- useAuth의 access는 loading/error/guest/unverified/suspended/allowed입니다.
- 학교 인증은 서버 profiles.verification_status=VERIFIED와 Auth 이메일 확인, 정확한 @jmail.ac.kr 도메인을 모두 요구합니다. 클라이언트에서 VERIFIED를 쓰지 않습니다.
- ACTIVE 이외 계정은 차단합니다. 정지 종료 시각이 없어도 임의 해제하지 않습니다.
- 학교 코드 확인 전 가입 상태(pending)는 로그인 세션이 아닙니다. 방/지갑/정산에 접근할 수 없습니다.

## 설정과 실행

mobile/.env에 프로젝트 URL과 공개 키를 넣습니다. EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 기존 팀 코드의 EXPO_PUBLIC_SUPABASE_ANON_KEY를 지원합니다. 관리자 키는 넣지 마세요. 지도 키도 mobile/.env에 둡니다. 실제 환경변수 파일은 Git에서 제외됩니다.

```powershell
cd mobile
npm ci
npm run web
npm run typecheck
npm run lint
npm run test:auth
```

Supabase 미설정 로컬 개발에서는 로그인 화면의 '개발용 둘러보기'로 기존 u1 시연 데이터를 사용합니다. 실제 로그인/학교 인증이 아니며 배포 빌드, 서버 연결 상태, 실제 미인증/정지 사용자는 이 경로를 이용할 수 없습니다.

## Supabase 연결

팀의 services/supabaseClient.ts를 재사용합니다. supabaseAdapter.ts는 signUp/signInWithPassword/getUser/resend/verifyOtp/signOut을 연결합니다. 세션 저장과 갱신은 기존 SDK 설정에 맡깁니다. 로그인/복원 후 서버의 본인 profiles 행을 조회합니다.

Confirm Email을 유지하고 가입 확인 메일 템플릿에 숫자 토큰을 넣어야 합니다. 가입 성공 시 세션이 없으면 이메일 코드 입력 화면으로 이동합니다. 전화번호는 필수 입력이며 현재 가입 사용자 메타데이터에 전달합니다. 공개 동승자 목록에는 전달하지 않습니다. 메타데이터의 인증·권한 값은 신뢰하지 않습니다.

## 병합 전 팀 검토 및 남은 작업

이 PR은 실제 Supabase/SMTP 통합 테스트 전의 초안입니다.

1. 기존 migrations 001~011의 실제 프로젝트 적용 여부와 환경변수 설정 확인.
2. 학교 이메일 실제 확인 이후 profiles.verification_status를 서버에서 갱신하는 트리거/RPC 구현. 현재 기존 main 스키마에는 이 연결이 없어 코드 확인만으로 서비스 접근이 허용되지 않습니다.
3. 전화번호 전용 저장 정책과 접근 권한 확정. 현재 원본은 본인 Auth 메타데이터이며 프로필 테이블에는 전화번호 열이 없습니다.
4. 정지 종료 시각(suspended_until)과 관리자 해제 절차 추가. 현재 열이 없으면 종료일 미정 안내로 차단합니다.
5. SMTP, 발신 도메인, Confirm Signup 숫자 토큰 템플릿 설정 및 학교 메일 수신/만료/재발송 검증.
6. 학교 도메인 제한과 정지/학교 인증 정책을 모든 서버 진입점에 적용. 현재 앱의 검사는 DB 권한 검사를 대체하지 않습니다.
7. 실제 세션 복원·만료·로그아웃·다른 사용자 전환과 정산 RPC 통합 검증.

실제 회원 생성/메일 발송/DB 마이그레이션은 이번 병합 작업에서 실행하지 않았습니다. 방·지도·지갑·정산 화면과 알고리즘은 main 변경을 그대로 보존했습니다.

참고: [Supabase React Native 인증](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Expo 보호 경로](https://docs.expo.dev/router/advanced/protected/).
