# 같이타요 모바일 앱

택시 동승과 TEST 크레딧 정산을 시연하는 Expo 앱입니다. 환경변수를 설정하면 Supabase Auth·방·예치·정산 RPC와 원장 조회를 사용합니다. 실제 결제, 지도 API, 블록체인은 연결하지 않았습니다. SQL은 아직 실제 Supabase 프로젝트에 적용·검증되지 않았습니다.

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm start
```

Supabase를 사용하려면 `.env.example`을 `mobile/.env`로 복사해 프로젝트 URL과 공개 anon/publishable 키를 채우고 앱을 다시 시작하세요. `EXPO_PUBLIC_KAKAO_MAP_KEY`는 지도 API를 연결할 때 사용할 자리표시자이며 현재 화면은 텍스트 기반 미리보기입니다. `service_role` 키는 절대 넣지 않습니다. DB에는 `supabase/migrations/`의 `001`~`011` 파일을 순서대로 적용하고, 개발용 네 계정은 [테스트 데이터 절차](../docs/test-data.md)를 따르세요. 두 Supabase 환경변수가 없으면 아래의 로컬 시연 모드로 실행됩니다. 실제 DB 검증 순서는 [통합 테스트](../docs/phase6-integration-test.md)에 있습니다.

Android 에뮬레이터가 준비되어 있으면 `npm run android`로 실행할 수 있습니다. 실제 Android 기기에서는 Expo Go에서 개발 서버의 QR 코드를 스캔하세요.

## 로컬 시연 모드 계정과 순서

- 이메일: `minji@example.com`
- 비밀번호: `1234`

1. 로그인 후 홈에서 `삼송역 → 중부대학교` 참여 중인 방을 선택합니다.
2. 방 상세의 `탑승 확인하기`를 누릅니다.
3. `탑승 완료`를 누르고 실제 택시 요금 `12000`을 입력합니다.
4. 3명 탑승 기준 1인 4,000P, 환불 1,000P를 확인하고 정산을 완료합니다.
5. 지갑과 마이페이지에서 변경된 잔액과 내역을 확인합니다.

동승 방 검색, 새 방 만들기, 포인트 충전, 회원가입, 로그아웃도 화면에서 동작합니다. 검색에 없는 장소를 입력하면 빈 상태가 표시됩니다. mock 데이터는 앱 프로세스를 다시 시작하면 초기화됩니다.

## 코드 구성

- `src/app`: Expo Router 화면
- `src/components/ui.tsx`: 공통 화면·버튼·카드·아바타 등
- `src/services/mockService.ts`: 초기 데이터, 인증·예치·정산 규칙
- `src/state/AppContext.tsx`: Supabase 데이터 조회·RPC와 환경변수 없는 경우의 로컬 시연 상태
- `src/services/capstoneApi.ts`: 변경 요청 ID 재사용 및 크레딧 요약 조회
- `src/types.ts`: 도메인 타입

Supabase 모드의 지급은 앱 버튼이 아니라 개발용 seed SQL로만 합니다. 예치·반환·차감은 RPC로 작성했지만 실제 DB 미적용이므로 동작을 아직 보증하지 않습니다. 로컬 시연 모드의 포인트·정산은 기존 mock 데이터일 뿐 서버 데이터와 연결되지 않습니다.

```bash
npm run typecheck
```
