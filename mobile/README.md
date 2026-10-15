# 같이타요 모바일 앱

택시 동승 방 생성·참여, TEST 크레딧 예치, 탑승 확인, 정산을 시연하는 Expo 앱입니다. main의 Supabase Auth·방·지갑·정산 RPC 연결 코드와 카카오 지도를 사용합니다. 실제 결제·블록체인은 연결하지 않았습니다.

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm start
```

Android 에뮬레이터가 준비되어 있으면 `npm run android`로 실행할 수 있습니다. 실제 Android 기기에서는 Expo Go에서 개발 서버의 QR 코드를 스캔하세요.

## 회원·인증 개발 상태

화면을 확인하려면 `npm run web` 실행 후 로그인 화면의 **개발용 둘러보기**를 누르세요. 기존 민지 시연 데이터로 홈·방·지갑·정산을 확인할 수 있습니다. 실제 계정이나 인증 상태는 생성하지 않으며, 새로고침하면 둘러보기가 종료됩니다. 시연 데이터 변경은 메모리에만 남습니다. 배포 빌드와 실제 인증 서버 연결 상태에서는 사용할 수 없습니다.

Supabase 환경변수가 없으면 실제 로그인·회원가입은 비활성화됩니다. 설정하면 팀의 Supabase 클라이언트와 profiles를 사용합니다. 기존 평문 시연 계정과 모의 로그인은 제거했습니다. 학교 인증 상태의 서버 반영과 SMTP 연결은 아직 추가 작업이 필요하며, 임의로 인증 완료 처리하지 않습니다.

mobile/.env.example의 URL과 공개 키를 mobile/.env에 설정하세요. EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY도 지원합니다. DB 설정은 main의 supabase/migrations/001~011 및 [통합 테스트 안내](../docs/phase6-integration-test.md)를 따릅니다. 이번 병합에서는 실제 DB 적용이나 메일 발송을 실행하지 않았습니다.

학교 이메일은 중부대학교 @jmail.ac.kr, 가입 정보는 닉네임·이메일·비밀번호·필수 전화번호입니다. 전화번호 수집은 휴대전화 본인 인증이 아닙니다.

[인증 연결 계약 및 테스트 안내](docs/auth-integration.md)를 확인하세요.

## 코드 구성

- `src/app`: Expo Router 화면
- `src/components/ui.tsx`: 공통 화면·버튼·카드·아바타 등
- `src/services/mockService.ts`: 초기 데이터, 예치·정산 규칙
- `src/state/AppContext.tsx`: 메모리 상태와 사용자 동작
- `src/types.ts`: 도메인 타입

AppContext는 main의 Supabase 조회·RPC와 로컬 시연 상태를 유지하며, 회원 인증은 AuthContext에서 전달받습니다. 서버 모드의 TEST 크레딧 지급은 팀의 개발용 seed 절차를 따릅니다.

```bash
npm run typecheck
```
