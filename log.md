# 작업 로그 / 재개용 안내

이 문서는 **다시 작업을 시작할 때 가장 먼저 읽는 문서**다.
무엇이 어디에 있고, 어떻게 띄우고, 무엇이 남아 있는지를 담았다.

- 최종 갱신: 2026-09-01
- 규칙 정리 문서: [`docs/RULES.md`](docs/RULES.md)
- 프로젝트 개요·배포 절차: [`README.md`](README.md)

---

## 1. 지금 어디서 돌아가고 있나

| 항목 | 값 |
|---|---|
| 서비스 주소 | https://marvelous-rabanadas-6be02f.netlify.app |
| 소스 저장소 | https://github.com/gud1396-coder/fox-webapp (**공개**) |
| 로컬 작업 폴더 | `C:\claude\claude\fox-webapp` |
| 프론트 호스팅 | Netlify — 프로젝트명 `marvelous-rabanadas-6be02f` |
| 서버 | Cloudflare Worker `fox-server` |
| 서버 주소 | https://fox-server.gud1396.workers.dev |
| Cloudflare 계정 | gud1396@hanilgo.cnehs.kr (`1444c3f0a48c411e2a07712d73d0e066`) |

`main` 에 푸시하면 **Netlify 가 자동 재배포**된다.
**Worker 는 자동 배포되지 않는다** — 아래 3절 참고.

### 설정값이 저장된 위치

| 설정 | 어디에 있나 |
|---|---|
| `VITE_SERVER_URL` | Netlify → Project configuration → Environment variables |
| `ALLOWED_ORIGINS` | `apps/server/wrangler.toml` 의 `[vars]` |
| `ADMIN_PASSWORD` | Cloudflare Worker 시크릿 (`wrangler secret`) — **값은 이 문서에 적지 않는다** |
| `CLOUDFLARE_API_TOKEN` | GitHub 리포 Secrets — **현재 유효하지 않음** (5절) |

> 저장소가 공개이므로 비밀번호·토큰을 파일에 적지 말 것.
> 관리자 비밀번호를 잊었으면 `npx wrangler secret put ADMIN_PASSWORD` 로 새로 넣으면 된다.
> 단, 화면 잠금용으로 `apps/web/src/App.tsx` 의 `ADMIN_PW` 상수도 함께 고쳐야 한다.

---

## 2. 파일이 어디에 있나

```
packages/engine/         규칙 엔진 (의존성 0). 서버와 클라이언트가 같이 쓴다.
  src/sheet.ts           점수판 데이터. 숫자·보너스 위치가 전부 여기 상수로 있다.
  src/types.ts           Action / Bonus / GameState 타입. 액션을 추가하면 여기부터.
  src/reducer.ts         게임 진행 규칙. 턴·페이즈 전이, 모든 액션 처리.
  src/sheetOps.ts        시트 조작과 보너스 연쇄. canUseDie() 도 여기.
  src/score.ts           점수 계산 (영역별 · 여우 · 합계).
  src/theme.ts           테마(원작 / 지구시스템)의 이름과 용어.
  src/engine.test.ts     테스트 32개.

apps/web/                React + Vite 클라이언트 → Netlify
  src/App.tsx            로비·게임 화면 전체, 관리자 모드, 설명서. (가장 큰 파일)
  src/Sheet.tsx          점수판 한 장을 그리는 컴포넌트. 보너스 배지·툴팁.
  src/useRoom.ts         WebSocket 연결과 전송 큐. 로컬 모드 분기도 여기.
  src/styles.css         전부 여기. 색 변수는 파일 맨 위 :root 에 있다.

apps/server/             Cloudflare Worker + Durable Object → Cloudflare
  src/index.ts           라우팅, 오리진 검사, 관리자 API, GameRoom DO.
  wrangler.toml          Worker 설정. ALLOWED_ORIGINS 도 여기.

docs/RULES.md            규칙 정리. 점수판 배치가 표로 정리돼 있다.
netlify.toml             Netlify 빌드 설정 (건드릴 일 거의 없음).
.github/workflows/       ci.yml(테스트) / deploy-server.yml(자동 배포, 현재 실패)
```

**어디를 고쳐야 하나**

| 하고 싶은 일 | 고칠 파일 |
|---|---|
| 점수·보너스 위치 수정 | `packages/engine/src/sheet.ts` |
| 규칙 자체를 바꾸기 | `packages/engine/src/reducer.ts` |
| 새 액션 추가 | `types.ts` 에 타입 → `reducer.ts` 에 처리 → `App.tsx` 에 버튼 |
| 화면 배치·색 | `apps/web/src/styles.css` |
| 점수판 모양 | `apps/web/src/Sheet.tsx` |
| 로비·관리자·설명서 | `apps/web/src/App.tsx` |
| 서버 API | `apps/server/src/index.ts` |

---

## 3. 작업 재개 절차

```bash
cd C:\claude\claude\fox-webapp
npm install                  # 처음 한 번만

npm test                     # 엔진 테스트 (빠름, 먼저 돌려볼 것)
npm run dev:server           # 로컬 서버 → localhost:8787
npm run dev:web              # 클라이언트 → localhost:5173
```

로컬에서 **온라인 모드**로 테스트하려면 서버 주소를 넘겨서 띄운다.
`wrangler.toml` 의 `ALLOWED_ORIGINS` 가 Netlify 도메인으로 고정돼 있으므로
로컬 서버는 오리진을 덮어써야 한다.

```bash
# 터미널 1
cd apps/server && npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://localhost:5173

# 터미널 2
cd apps/web && VITE_SERVER_URL=ws://localhost:8787 npx vite --port 5173
```

PowerShell 이면 두 번째 줄은 이렇게:

```powershell
cd apps/web; $env:VITE_SERVER_URL='ws://localhost:8787'; npx vite --port 5173
```

### 배포

```bash
npm test && npm run build:web        # 먼저 검증
git push origin main                 # → Netlify 자동 재배포

# 엔진이나 서버를 고쳤으면 Worker 도 반드시 따로 배포해야 한다
npm run build:engine
npm run deploy -w @fox/server
```

> **엔진(`packages/engine`)을 고치면 Worker 재배포가 필수다.**
> 서버가 같은 엔진을 번들해서 쓰기 때문에, 프론트만 배포하면 규칙이 어긋난다.

---

## 4. 운영 중 알아둘 것

### 관리자 모드
로비 맨 아래 "관리자 모드" → 비밀번호 입력. 세 가지를 할 수 있다.

- **테마 선택** — 수업 중 학생이 못 바꾸도록 여기로 옮겨두었다.
- **이 브라우저 정보 삭제** — `localStorage`(이름·플레이어ID·테마)만 지운다. **나만 영향.**
- **모든 방 초기화** — 서버의 모든 방 진행 상황을 지운다. **전원 영향.** 브라우저 정보는 안 지운다.
- **서버 연결 차단 on/off** — 켜면 새 접속이 503 으로 막힌다. 수업 시간 외 사용 제한용.
  **이미 접속 중인 사람은 안 끊긴다.** 끊으려면 "모든 방 초기화" 를 같이 누른다.

### 서버 API (직접 호출할 일이 있으면)

```bash
curl https://fox-server.gud1396.workers.dev/health           # ok
curl https://fox-server.gud1396.workers.dev/admin/lock       # {"locked":false}

curl -X POST -H "content-type: application/json" \
  -H "Origin: https://marvelous-rabanadas-6be02f.netlify.app" \
  -d '{"password":"...","locked":true}' \
  https://fox-server.gud1396.workers.dev/admin/lock
```

### 방 상태는 계속 남는다
Durable Object 가 방마다 상태를 영구 저장한다. 같은 방 코드로 다시 들어가면
지난 게임이 이어진다. 새로 시작하려면 **방 코드를 바꾸거나 "모든 방 초기화"** 를 쓴다.

---

## 5. 알려진 문제 / 남은 일

**1. GitHub Actions 자동 배포가 실패한다**
`deploy-server` 워크플로가 `Authentication failed (status: 400) [code: 9106]` 로 끝난다.
등록된 `CLOUDFLARE_API_TOKEN` 이 유효하지 않다. 값에 공백이 섞였거나, API 토큰이 아닌
계정 ID/Global Key 를 넣었을 가능성이 크다.
→ 토큰을 새로 발급해 시크릿을 덮어쓰면 된다. 확인은
`curl -H "Authorization: Bearer <토큰>" https://api.cloudflare.com/client/v4/user/tokens/verify`
로 `"success": true` 를 보면 된다.
자동 배포를 안 쓸 거면 `.github/workflows/deploy-server.yml` 을 지워도 된다.
**현재 Worker 는 CLI 로 배포하고 있어 서비스에는 문제가 없다.**

**2. 관리자 패널의 화면 잠금은 클라이언트 검사다**
`App.tsx` 의 `ADMIN_PW` 상수와 비교하므로 개발자도구로 볼 수 있다.
다만 **방 초기화·서버 차단은 서버가 비밀번호를 다시 검증**하므로 실제 파괴적 동작은 막혀 있다.
더 단단히 하려면 패널 잠금도 서버 검증으로 바꾸면 되는데, 그러면 로컬 모드에서 관리자 모드를 못 쓴다.

**3. 같은 브라우저의 여러 탭은 같은 사람으로 잡힌다**
`localStorage` 의 `fox.pid` 를 공유하기 때문. 혼자 테스트할 때는 시크릿 창을 쓴다.

**4. 진행 중 합류한 사람은 놓친 라운드 보너스를 못 받는다**
그 턴은 건너뛴 것으로 처리되고 다음 턴부터 참여한다. 라운드 수는 시작 시점 인원으로
정해져 나중에 들어와도 바뀌지 않는다. 의도된 동작이지만 불만이 나오면 손볼 지점.

**5. 일부 네트워크에서 `*.workers.dev` 가 막힐 수 있다**
작업 중 한 네트워크에서 TLS 핸드셰이크 단계부터 차단되는 것을 확인했다
(무관한 `example.workers.dev` 도 동일). 교실에서 접속이 안 되면 이걸 의심할 것.
휴대폰 데이터로 접속해보면 바로 판별된다. 해결은 관리자에게 허용 요청하거나
Worker 에 커스텀 도메인을 붙이는 것.

**6. wrangler 가 3.114.17 이다**
4.x 업데이트 권고가 뜨지만 현재 배포에는 문제없다.

---

## 6. 지금까지 한 일

`git log` 에 상세 내용이 있다. 특정 커밋은 `git show <해시>` 로 본다.

### 규칙 정확성
- `f03ab7a` **점수판 배치 확정** — 실물 점수판 이미지를 확대 판독해 `sheet.ts` 의 임시값
  5곳을 교체. 초록·주황·보라가 공통적으로 한 칸씩 밀려 있었고, 보라는 보너스가
  5개가 아니라 9개였다. 회귀 테스트 5개 추가.
- `9729044` **은쟁반 특례 강제** — 룰북상 은쟁반에 쓸 수 있는 주사위가 있으면 액티브의
  주사위를 가져갈 수 없다. 주석에 의도만 있고 구현이 없었다. `canUseDie()` 추가.

### 접속·진행 버그
- `8c16151` **참가가 서버로 안 가던 문제** — 방에 들어갔다 곧바로 튕겨나오던 증상.
  스테일 클로저와 50ms 경쟁이 원인. 전송 큐를 도입했다.
- `a0e58bc` 새로고침 재접속 허용 / `962b143` 진행 중 합류 허용
- `6778866` 종료 화면이 `7/6` 으로 표시되던 문제

### UI
- `60cf278` 실물 배치 반영, 컨트롤바 분리 · `b5c0b07` 보너스 색 배지, 설명서 모달
- `d8d9f76` 노랑→빨강, 화면 맞춤 자동 배율 · `e145548` 여백 정리
- `97da4bd` 수권 점수표를 세로 2열로 · `fb9c532` 좌우 컨트롤바 + 플레이어별 탭

### 운영
- `467968e` 관리자 모드 · `6778866` 서버 차단, 눈 다시 입력

### 실물 반영 (주사위 세트에 맞춤)
- 흰색 → **핑크** (`white` 식별자는 그대로)
- 노랑 → **빨강** (`yellow` 식별자는 그대로)

> 색 이름을 또 바꿔야 하면 `App.tsx` 의 `DIE_KO`, `styles.css` 의 `:root` 색 변수,
> `theme.ts` 의 `areas.<색>.name` 세 곳을 함께 고친다. 엔진 식별자는 건드리지 않는다.
