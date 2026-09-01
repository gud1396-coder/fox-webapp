# 영리한 여우 — 온라인 점수판

보드게임 *Ganz schön clever* (영리한 여우)의 웹 점수판.
**주사위는 실물로 굴리고 눈만 입력**하면, 규칙 검증 · 보너스 연쇄 · 점수 계산 · 턴 진행을 앱이 처리합니다.

통합과학 수업용 **지구시스템 테마**를 내장하고 있습니다 (원작 테마와 토글).

> **다시 작업을 시작한다면 [`log.md`](log.md) 를 먼저 읽으세요.**
> 배포 주소·설정값 위치·파일 지도·재개 절차·남은 문제가 정리돼 있습니다.

## 구조

```
packages/engine/   순수 TypeScript 규칙 엔진 (의존성 0, 테스트 32개)
apps/web/          React + Vite 클라이언트  → Netlify
apps/server/       Cloudflare Worker + Durable Object → Cloudflare
```

규칙은 전부 `packages/engine` 안에 있고, 서버와 클라이언트는 같은 엔진을 씁니다.
점수판의 숫자·보너스 배치는 `packages/engine/src/sheet.ts` 한 파일에 데이터로 모여 있습니다.

## 두 가지 동작 모드

| 모드 | 조건 | 동작 |
|---|---|---|
| **로컬** | `VITE_SERVER_URL` 미설정 | 브라우저 안에서 엔진을 직접 실행. 한 대로 돌려가며 플레이 |
| **온라인** | `VITE_SERVER_URL` 설정 | 방 코드로 접속, Durable Object 가 상태를 중계 |

Netlify 배포만 해도 **로컬 모드로 즉시 동작**합니다. 온라인은 아래 2단계를 추가하면 됩니다.

## 배포

### 1. GitHub

```bash
git init
git add -A
git commit -m "init"
git branch -M main
git remote add origin https://github.com/gud1396-coder/fox-webapp.git
git push -u origin main
```

### 2. Netlify (프론트엔드)

Netlify 대시보드 → **Add new site → Import an existing project** → GitHub 리포 선택.
`netlify.toml` 이 있으므로 빌드 설정은 자동으로 잡힙니다.

- Build command: `npm run build:web`
- Publish directory: `apps/web/dist`

여기까지만 해도 **로컬 모드로 바로 쓸 수 있습니다.**

### 3. Cloudflare (온라인 멀티 — 선택)

```bash
npm install -g wrangler
wrangler login
cd apps/server && wrangler deploy
```

배포되면 `https://fox-server.<계정>.workers.dev` 주소가 나옵니다.

1. Netlify 환경변수에 `VITE_SERVER_URL = wss://fox-server.<계정>.workers.dev` 추가 후 재배포
2. `apps/server/wrangler.toml` 의 `ALLOWED_ORIGINS` 를 Netlify 도메인으로 설정하고 재배포

GitHub Actions 로 자동 배포하려면 리포 Secrets 에 `CLOUDFLARE_API_TOKEN` 을 추가하세요
(`.github/workflows/deploy-server.yml` 이 `apps/server` 나 `packages/engine` 변경 시 자동 실행).

> Cloudflare Workers 무료 플랜은 SQLite 백엔드 Durable Object 를 지원하며 SQLite 스토리지 요금이 없습니다.
> `wrangler.toml` 이 `new_sqlite_classes` 를 쓰는 이유입니다 — `new_classes` 로 바꾸면 무료 플랜에서 배포가 거부됩니다.

## 개발

```bash
npm install
npm test              # 엔진 테스트
npm run dev:web       # 클라이언트 (로컬 모드)
npm run dev:server    # wrangler dev
```

## 아직 확인이 필요한 시트 데이터

공식 룰북 PDF 의 벡터 텍스트에서 뽑아낸 값은 확정이지만,
**아이콘으로 그려진 부분은 추출되지 않아 임시값**이 들어 있습니다.
`packages/engine/src/sheet.ts` 에서 `TODO(` 로 표시된 곳이며, 실물 점수판 사진 1장이면 전부 확정됩니다.

확정된 값 / 남은 항목은 `docs/RULES.md` 를 참고하세요.
