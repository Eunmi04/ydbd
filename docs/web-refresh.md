
## 변경 사항

- 새 동승 방은 최대 4명이다. 인원 선택을 없애고 방장 포함 2명부터 준비를 시작할 수 있도록 안내한다.
- DB의 기존 최소 인원 2명·준비·예치·정산 규칙은 유지한다. 새 방 생성 RPC만 4명을 강제하는
  `supabase/migrations/202610220015_fixed_room_capacity.sql`을 추가했다.
  SQL Editor에서 이 새 파일만 적용한다. 001~014를 재실행하거나 기존 방을 수정하지 않는다.
- 마이페이지의 수정 폼을 `/settings` 보호 화면으로 이동했다.
  마이페이지 → 회원 설정 · 개인정보 수정 → 닉네임·학교명 저장 순서로 사용한다.
  기존 Supabase 본인 프로필 저장·접근 정책을 그대로 사용하며 이메일·인증 상태는 조회만 가능하다.
- 크림색 배경, 검정 제목·버튼, 연두색 강조와 손그림 일러스트를 적용했다.
  넓은 웹에서는 상단 메뉴와 가로 레이아웃을 쓰고 작은 화면에서는 하단 탭과 세로 배치를 유지한다.
- 홈의 출발지·도착지 검색은 실제 방 목록으로 연결된다.
  기존 지갑·지도·탑승·정산·이용 내역 화면과 사용자 정보는 유지한다.

## 일러스트

생성 도구: 내장 `image_gen` (`imagegen` 스킬). 투명 PNG를 생성해 프로젝트 안에 복사했다.
최종 경로: `mobile/assets/images/taxi-doodle.png`.
화면 전체를 이미지로 대체하지 않고 실제 홈·로그인·방 화면의 일러스트로 사용한다.

최종 생성 프롬프트:

> Use case: illustration-story. Asset type: transparent PNG hero illustration for a Korean taxi sharing web app. Primary request: charming black hand-drawn ink doodle of two friendly rounded white blob characters with little feet smiling next to a compact white taxi, one holding a phone and one waving, small loose city buildings, two simple trees and one cloud in the background. Match the supplied site's visual direction in words: imperfect confident thick black marker outlines, warm human handmade feel, minimal lime-green accent strokes #85e648, white filled characters and taxi, no gradients, no shadows, no photorealism, no 3D. Wide landscape composition, all objects comfortably inside margins, grounded together on one short wobbly line, generous transparent negative space, suitable for cream #f7f4ec background. Only text allowed is tiny TAXI on the taxi roof sign. No Korean text, no logos, no UI, no watermark. Genuine transparent background. Output final image as an asset and provide its local saved path.

## 검증 범위

타입 검사와 수정 파일의 린트, 기존 인증·프로필·크레딧 테스트 13개를 수행한다.
웹 브라우저에서 별도 테스트 계정으로 로그인·설정 저장·새로고침 후 유지·4명 방 생성과
실제 DB 저장·목록 표시·작은 화면의 가로 넘침을 확인한다.
015 SQL은 로컬에 작성한 파일이며 관리자 적용 전까지 원격 DB에 적용했다고 간주하지 않는다.
전체 린트에는 기존 `KakaoMap.web.tsx:22` 오류와 `mockService.ts:252` 경고가 남아 있다.
