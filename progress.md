# 운영 안내 — 프로그램을 돌리는 데 필요한 것

이 문서만 있으면 **띄우고, 고치고, 배포하고, 수업에 쓸 수 있다.**
지금까지 무엇을 왜 고쳤는지는 [`log.md`](log.md) 에 있다.

- 최종 갱신: 2026-09-05
- 규칙 정리: [`docs/RULES.md`](docs/RULES.md) · 프로젝트 개요: [`README.md`](README.md)

---

## 1. 주소와 계정

| 항목 | 값 |
|---|---|
| 서비스 (학생 접속) | https://fox-webapp.pages.dev |
| 예전 주소 (아직 살아 있음) | https://marvelous-rabanadas-6be02f.netlify.app |
| 저장소 | https://github.com/gud1396-coder/fox-webapp (**공개**) |
| 로컬 작업 폴더 | `C:\claude\claude\fox-webapp` |
| 프론트 호스팅 | Cloudflare Pages — 프로젝트 `fox-webapp` |
| 서버 | Cloudflare Worker `fox-server` |
| 서버 주소 | https://fox-server.gud1396.workers.dev |
| Cloudflare 계정 | gud1396@hanilgo.cnehs.kr (`1444c3f0a48c411e2a07712d73d0e066`) |

**자동 배포는 없다. 푸시해도 아무것도 올라가지 않는다.**
프런트는 `npm run deploy:web`, 서버는 `npm run deploy:server` 로 직접 올린다.

> 예전 Netlify 주소는 `main` 푸시마다 여전히 자동 재배포된다. 이관이 확인될 때까지
> 남겨둔 것이라, 두 주소가 다른 버전을 보일 수 있다. **수업에는 Pages 주소를 쓴다.**

### 설정값이 저장된 위치

| 설정 | 어디에 |
|---|---|
| `VITE_SERVER_URL` | `apps/web/.env.production` (저장소에 있다 — 공개 Worker 주소라 비밀이 아니다) |
| `ALLOWED_ORIGINS` | `apps/server/wrangler.toml` 의 `[vars]` |
| `ADMIN_PASSWORD` | Cloudflare Worker 시크릿 — **값은 문서에 적지 않는다** |

> 저장소가 공개다. 비밀번호·토큰을 파일에 적지 말 것.
> 관리자 비밀번호를 바꾸려면 `npx wrangler secret put ADMIN_PASSWORD` 를 실행하고,
> 화면 잠금용인 `apps/web/src/App.tsx` 의 `ADMIN_PW` 상수도 **함께** 고친다.

---

## 2. 수업에서 쓰는 법

1. 학생들에게 주소를 알려준다. 방 코드까지 담아 링크로 주면 입력이 준다.
   `https://fox-webapp.pages.dev/#/SCIENCE1`
2. 각자 이름을 넣고 **참가**. 로비에 참가자가 실시간으로 쌓인다.
3. 다 모이면 아무나 **시작**. 혼자일 때는 시작이 잠겨 있고,
   굳이 혼자 하려면 아래 "혼자 연습하기" 를 눌러야 한다.
4. 주사위는 실물로 굴리고 **눈만 입력**한다. 규칙 검증·보너스 연쇄·점수는 앱이 처리한다.

**인원별 라운드 수**: 1·2인 6라운드 / 3인 5라운드 / 4인 4라운드 (최대 4인)

### 알아둘 동작

- **방 상태는 계속 남는다.** 같은 방 코드로 다시 들어가면 지난 게임이 이어진다.
  새로 시작하려면 방 코드를 바꾸거나 관리자 모드에서 "모든 방 초기화" 를 쓴다.
- **같은 브라우저의 여러 탭은 같은 사람으로 잡힌다** (`localStorage` 의 `fox.pid` 공유).
  혼자 여러 명을 테스트할 때는 시크릿 창을 쓴다.
- **새로고침하면 저절로 돌아온다.** 버튼을 누를 필요가 없다. 게임 중이었으면 게임 화면으로
  바로 복귀한다. 단 **방 나가기** 로 나간 경우는 자동 복귀하지 않는다(나간 것은 학생의 뜻이므로).
  이때도 이름과 방 코드는 칸에 남아 있으니 **참가** 만 누르면 된다.
- **방 코드 없이는 참가할 수 없다.** 코드 칸이 비면 참가 버튼이 잠긴다.
  (예전에는 코드 없이 눌리면서 학생이 빈 방에 혼자 갇혔다. log.md 참고)
- **참가 전에도 방 상태가 보인다.** 코드를 넣으면 "이미 N명이 있습니다" 또는
  "아직 비어 있습니다" 가 뜬다. **코드를 잘못 적었는지 참가 전에 알 수 있다.**
- **연결 상태를 로비가 알려준다.** 끊기면 빨간 배너와 "지금 다시 연결" 버튼이 뜬다.
  "접속이 안 돼요" 라는 학생에게 **화면에 무엇이 보이는지 물어보면 바로 분류된다.**
- **접속이 끊겨도 저절로 복구된다.** 다시 붙으면 참가가 자동으로 재전송된다.
  25초마다 신호를 주고받아, 조용히 죽은 연결도 30초 안에 알아채고 다시 붙는다.
- **한 명이 끊겨도 게임은 계속할 수 있다.** 끊긴 사람이 생기면 게임 화면에
  "OO 님의 연결이 끊겼습니다 · **건너뛰고 진행**" 이 뜬다. 아무나 누르면 된다.
  건너뛴 사람은 **그 차례의 보너스를 못 받고**, 돌아오면 다음 차례부터 정상 참여한다.
  잠깐 끊긴 것 같으면 누르지 말고 기다리면 저절로 돌아온다.
- **늦게 온 사람도 들어올 수 있다.** 그 턴은 건너뛰고 다음 턴부터 참여한다.
  다만 지나간 라운드의 시작 보너스는 받지 못하고, 라운드 수는 시작 시점 인원 기준이라 바뀌지 않는다.
- **연결 진단** — 로비 아래 버튼. 그 기기가 서버에 닿는지 확인한다.
  "접속이 안 돼요" 라는 학생이 있으면 이걸 눌러보게 한다.
  게임이 실제로 쓰는 **WebSocket 으로** 시험하므로 결과가 곧 "이 기기로 게임이 되는가" 다.
  서버는 살아 있는데 방 접속만 거부되면 **관리자 차단을 확인하라**고 알려준다.

> **접속이 전부 안 될 때는 관리자 모드의 "연결 차단" 부터 확인한다.**
> 차단이 켜져 있으면 모든 접속이 503 으로 막힌다. 상태 표시가 **"확인 못 함"** 이면
> 조회에 실패한 것이니, **"연결 허용하기"** 를 그냥 눌러 원하는 상태로 직접 지정한다.
>
> ~~이 PC 에서는 관리자 기능이 동작하지 않는다~~ — **2026-09-05 확인 결과 이 PC 에서도 된다.**
> 브라우저에서 `/admin/lock` 이 200 으로 응답한다. 예전 판단은 `curl` 결과만 보고 내린 것이다.

---

## 3. 관리자 모드

로비 맨 아래 **관리자 모드** → 비밀번호 입력.

| 기능 | 하는 일 | 영향 범위 |
|---|---|---|
| 테마 선택 | 지구시스템 / 원작 전환 | 이 브라우저 |
| 이 브라우저 정보 삭제 | `localStorage`(이름·플레이어ID·테마) 삭제 | **나만** |
| 모든 방 초기화 | 서버의 **모든 방** 진행 상황 삭제, 접속자 연결 끊김 | **전원** |
| 서버 연결 차단 on/off | 켜면 새 접속이 503 으로 막힘 | **전원** |

주의할 점 두 가지다.

- "모든 방 초기화" 는 **브라우저 정보를 지우지 않는다.** 둘은 별개 버튼이다.
- "서버 연결 차단" 은 **새 접속만** 막는다. 이미 들어와 있는 사람은 계속 진행한다.
  전부 끊으려면 "모든 방 초기화" 를 같이 누른다.

수업 시간 외 사용을 막으려면 끝나고 **차단 on**, 시작 전에 **차단 off** 로 쓰면 된다.

### 서버 API 직접 호출

```bash
curl https://fox-server.gud1396.workers.dev/health      # ok
curl https://fox-server.gud1396.workers.dev/admin/lock  # {"locked":false}
```

> **이 PC 의 git-bash `curl` 로는 Worker 에 닿지 않는다.** schannel 백엔드 문제이며
> 네트워크 차단이 아니다 (log.md 참고). **`node -e "fetch(...)"` 와 브라우저는 된다**
> (2026-09-05 재확인: `/health` 200). 둘 중 아무거나 쓰면 된다.
> 단 `/admin/lock` 은 오리진을 보므로 node 로는 403 이 난다. **브라우저 콘솔로 확인한다.**

### 서버가 무엇을 돌려주는지 보는 법 — `wrangler tail`

학생이 "안 돼요" 라고 할 때 **추측하지 않고 실제 응답 코드를 볼 수 있다.**

```bash
cd apps/server
npx wrangler tail fox-server --format json   # 학생에게 다시 시도해 보라고 한다
```

요청마다 `event.request.headers.origin` 과 `event.response.status` 가 찍힌다.
읽는 법은 간단하다.

| 보이는 것 | 뜻 | 할 일 |
|---|---|---|
| 아무것도 안 찍힘 | 요청이 서버까지 오지도 못했다 | 그 기기의 망 문제 |
| `403` | 오리진 거부 | `ALLOWED_ORIGINS` 에 그 주소가 없다 |
| `503` | **관리자 차단이 켜져 있다** | 관리자 모드에서 "연결 허용하기" |
| `101` | 정상 접속 | 서버 문제 아님 |

`tail` 은 Cloudflare API 로 붙으므로 **내 PC 가 `workers.dev` 에 못 닿아도 동작한다.**

---

## 4. 개발 · 배포

```bash
cd C:\claude\claude\fox-webapp
npm install            # 처음 한 번

npm test               # 엔진 테스트 36개 (빠르다, 먼저 돌릴 것)
npm run dev:web        # 클라이언트 → localhost:5173
npm run dev:server     # 로컬 서버   → localhost:8787
```

로컬에서 **온라인 모드**로 테스트하려면 서버 주소를 넘기고, 로컬 서버의 오리진 제한을 푼다.

```bash
# 터미널 1
cd apps/server && npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://localhost:5173

# 터미널 2 (PowerShell)
cd apps/web; $env:VITE_SERVER_URL='ws://localhost:8787'; npx vite --port 5173
```

### 배포

```bash
npm test                          # 먼저 통과시킬 것
npm run deploy:web                # 빌드 + Pages 업로드 → https://fox-webapp.pages.dev
npm run deploy:server             # 엔진 빌드 + Worker 배포 (필요할 때만)
git push origin main              # 기록용. 이것만으로는 아무것도 배포되지 않는다
```

> **`packages/engine` 을 고쳤으면 `npm run deploy:server` 도 필수다.**
> 서버가 같은 엔진을 번들해서 쓰기 때문에, 프론트만 배포하면 규칙이 어긋난다.

> **프런트 주소를 바꾸면 `ALLOWED_ORIGINS` 도 같이 고치고 Worker 를 재배포한다.**
> 목록에 없는 주소에서는 방 접속이 거부된다. `wrangler pages deploy` 가 찍어주는
> `<해시>.fox-webapp.pages.dev` 미리보기 주소도 목록에 없어 **게임이 붙지 않는다.**
> 확인은 항상 `https://fox-webapp.pages.dev` 로 한다.

---

## 5. 소스 구조

```
packages/engine/         규칙 엔진 (의존성 0). 서버와 클라이언트가 같이 쓴다.
  src/sheet.ts           점수판 데이터 — 숫자·보너스 위치가 전부 상수로 있다.
  src/types.ts           Action / Bonus / GameState 타입.
  src/reducer.ts         게임 진행 규칙. 턴·페이즈 전이, 모든 액션 처리.
  src/sheetOps.ts        시트 조작과 보너스 연쇄. canUseDie() 도 여기.
  src/score.ts           점수 계산 (영역별 · 여우 · 합계).
  src/theme.ts           테마(원작 / 지구시스템)의 이름과 용어.
  src/engine.test.ts     테스트 36개.

apps/web/                React + Vite → Cloudflare Pages
  src/App.tsx            로비·게임 화면, 관리자 모드, 설명서, 연결 진단.
  src/Sheet.tsx          점수판 한 장. 보너스 배지·툴팁.
  src/useRoom.ts         WebSocket 연결과 전송 큐. HAS_SERVER 도 여기.
  src/styles.css         스타일 전부. 색 변수는 맨 위 :root.

apps/server/             Cloudflare Worker + Durable Object
  src/index.ts           라우팅, 오리진 검사, 관리자 API, GameRoom DO.
  wrangler.toml          Worker 설정.

.github/workflows/ci.yml 푸시마다 테스트·빌드 검사. (자동 배포는 없다)
```

**무엇을 고치려면 어디를 보나**

| 하고 싶은 일 | 파일 |
|---|---|
| 점수·보너스 위치 | `packages/engine/src/sheet.ts` |
| 규칙 자체 | `packages/engine/src/reducer.ts` |
| 새 액션 추가 | `types.ts` 타입 → `reducer.ts` 처리 → `App.tsx` 버튼 |
| 화면 배치·색 | `apps/web/src/styles.css` |
| 점수판 모양 | `apps/web/src/Sheet.tsx` |
| 로비·관리자·설명서 | `apps/web/src/App.tsx` |
| 서버 API | `apps/server/src/index.ts` |

### 색 이름을 바꿀 때
실물 주사위에 맞춰 **흰색 → 핑크**, **노랑 → 빨강** 으로 표기만 바꿔 쓰고 있다.
엔진 식별자(`white`, `yellow`)는 그대로 두고 아래 세 곳만 고친다.

- `apps/web/src/App.tsx` 의 `DIE_KO`
- `apps/web/src/styles.css` 의 `:root` 색 변수
- `packages/engine/src/theme.ts` 의 `areas.<색>.name`

---

## 6. 남아 있는 제약

고치지 않기로 한 것들이다. 문제가 되면 그때 손보면 된다.

1. **같은 브라우저 탭 = 같은 사람** — `fox.pid` 공유. 테스트는 시크릿 창으로.
2. **관리자 화면 잠금은 클라이언트 검사** — `ADMIN_PW` 상수 비교라 개발자도구로 볼 수 있다.
   다만 **방 초기화·서버 차단은 서버가 비밀번호를 다시 검증**하므로 파괴적 동작은 막혀 있다.
3. **진행 중 합류자는 놓친 라운드 보너스를 못 받는다.**
4. **wrangler 3.114.17** — 4.x 권고가 뜨지만 배포에는 문제없다.
5. **"건너뛰고 진행" 은 사람이 누른다.** 자동으로 건너뛰지 않는다. 잠깐 끊긴 것까지
   기계가 건너뛰면 억울한 경우가 생기므로 판단은 교실에 맡겼다.
6. **라운드 보너스 단계에서 액티브가 끊긴 경우는 두 번 눌러야 한다.**
   한 번은 보너스 배리어를, 한 번은 그 차례를 푼다. 흔한 경우는 아니다.
