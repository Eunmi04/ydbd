# 3단계 모바일 연동과 남은 범위

> 이 문서는 3단계 시점의 기록이다. 이후 작성한 예치·정산 RPC 및 모바일 연결은 [4단계](phase4-credit-rpc.md), [5단계](phase5-settlement.md), [6단계 검증](phase6-integration-test.md)을 우선한다. 아래의 "동작하지 않는다"와 "다음 단계 후보" 문장은 당시 상태이며 현재 코드 상태가 아니다. 실제 Supabase 적용·실행 검증은 여전히 필요하다.

앱은 `EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 모두 있으면 Supabase 모드로 시작한다. 공개 anon/publishable 키만 사용한다. `.env.example`을 복사해 `mobile/.env`에 값을 넣고 재시작한다. 실사용 Supabase 프로젝트에는 1~6번 마이그레이션을 파일명 순서로 적용해야 한다. 환경변수가 없으면 기존 메모리 시연 모드로 시작하며 실제 DB에 저장되지 않는다. 부분 설정도 시연 모드가 되므로 두 값을 함께 확인한다.

Supabase 모드에서 로그인·가입·로그아웃은 Auth API를 사용하고 앱 시작 시 세션을 복원한다. 이메일 확인이 켜진 프로젝트에서는 가입 직후 세션이 없을 수 있으므로 확인 후 로그인해야 한다. Supabase SDK가 세션을 관리하며 앱 코드는 비밀번호·토큰을 직접 저장하지 않는다. 비밀번호 자체는 Auth에만 전달하고 `profiles`에는 넣지 않는다. 라우트 보호는 클라이언트 이동 제한이며 실제 데이터 권한은 RLS가 맡는다.

방 목록·상세·생성·참여·참여자 목록은 Supabase를 사용한다. 방 생성 후 방장 참여 행은 DB 트리거가 만든다. 참여 전에는 다른 방의 인원 수를 `?`로 표시하고 참여자 행을 조회하지 않는다. 참여 후에도 다른 사람의 프로필은 읽지 않고 익명으로 표시한다. 지도 미리보기는 기존 텍스트 기반 시연 컴포넌트이며 지도 API 호출이 아니다. 기존 시연 상태 `recruiting → OPEN`, `confirmed → FIXED`, `settled → SETTLED`로 대응한다. 그 밖의 DB 상태는 기존 화면에서 `진행 중`으로 단순 표시하며 후속 화면에서 세분화한다.

Supabase 모드에서 지갑·충전·예치·준비 버튼·30초 제한·FIX·탑승·정산·반환·블록체인은 동작하지 않는다. 지갑은 안내 화면이고 방 상세는 참여만 가능하다. 예치 숫자는 예상 표시이며 실제 원장을 변경하지 않는다. 로컬 시연 모드의 `mockService`에는 기존 포인트·정산 동작이 남아 있지만 서버 데이터와 섞이지 않는다. 모드별 차이를 화면에도 표시한다.

다음 단계의 서버 RPC 후보는 `createRoom`, `joinOpenRoom`, `leaveOpenRoom`, `startReadyCheck`, `reserveRoomCredit`, `submitReady`, `cancelRoomAndRelease`, `reportBoardingIssue`, `submitFare`, `confirmFare`, `raiseDispute`, `applySettlement`이다. 특히 앞의 방·참여 직접 INSERT/UPDATE를 RPC로 전환하고 기존 클라이언트 쓰기 권한을 회수해야 한다. 이후 원장 합계 조회와 정확한 요청 재생용 `idempotency_requests`도 필요하다. 실제 결제·현금화·블록체인·GPS·채팅·택시 호출은 범위 밖이다.

검증: 타입 검사와 린트, 개발 Supabase에서 가입→프로필·지갑 자동 생성→로그인→방 생성→HOST 행 확인→다른 계정 참여→정원 초과 거부→타인 프로필 조회 거부→로그아웃·세션 복원을 순서대로 시험한다. 현재 로컬 환경에서 실제 Supabase 프로젝트 적용은 별도 확인이 필요하다.
