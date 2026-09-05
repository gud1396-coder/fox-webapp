# 영리한 여우 — 온라인 점수판

보드게임 *Ganz schön clever* (영리한 여우)의 웹 점수판.
**주사위는 실물로 굴리고 눈만 입력**하면, 규칙 검증 · 보너스 연쇄 · 점수 계산 · 턴 진행을 앱이 처리합니다.

통합과학 수업용 **지구시스템 테마**를 내장하고 있습니다 (원작 테마와 토글).

> **[`progress.md`](progress.md)** — 주소·설정값 위치·수업 사용법·관리자 모드·개발/배포 절차.
> 띄우고 고치고 수업에 쓰려면 이 문서만 보면 됩니다.
>
> **[`log.md`](log.md)** — 무엇을 왜 고쳤는지의 이력과, 다시 작업할 때 유의할 점.

## 구조

```
packages/engine/   순수 TypeScript 규칙 엔진 (의존성 0, 테스트 36개)
apps/web/          React + Vite 클라이언트  → Cloudflare Pages
apps/server/       Cloudflare Worker + Durable Object → Cloudflare
```

규칙은 전부 `packages/engine` 안에 있고, 서버와 클라이언트는 같은 엔진을 씁니다.
점수판의 숫자·보너스 배치는 `packages/engine/src/sheet.ts` 한 파일에 데이터로 모여 있습니다.

## 두 가지 동작 모드

| 모드 | 조건 | 동작 |
|---|---|---|
| **로컬** | `VITE_SERVER_URL` 미설정 | 브라우저 안에서 엔진을 직접 실행. 한 대로 돌려가며 플레이 |
| **온라인** | `VITE_SERVER_URL` 설정 | 방 코드로 접속, Durable Object 가 상태를 중계 |

프런트만 배포해도 **로컬 모드로 즉시 동작**합니다. 온라인은 Worker 를 함께 올리면 됩니다.

## 배포

프런트(Pages)와 서버(Worker) **둘 다 CLI 로** 올립니다. 푸시로 자동 배포되는 것은 없습니다.

```bash
npm test            # 먼저 통과시킬 것
npm run deploy:web     # 빌드 + Cloudflare Pages 업로드 → https://fox-webapp.pages.dev
npm run deploy:server  # 엔진 빌드 + Worker 배포 (engine/server 를 고쳤을 때만)
```

### 처음 한 번만 하는 준비

```bash
npx wrangler login                                          # Cloudflare 로그인
npx wrangler pages project create fox-webapp --production-branch main
```

서버 주소는 `apps/web/.env.production` 에 들어 있고 빌드 때 번들에 박힙니다
(공개 Worker 주소라 비밀이 아닙니다). 개발 서버(`npm run dev:web`)에는 적용되지 않아
그때는 로컬 모드로 돕니다.

Worker 를 처음 올렸다면 `apps/server/wrangler.toml` 의 `ALLOWED_ORIGINS` 에
프런트 주소를 넣고 `npm run deploy:server` 를 다시 실행하세요. 여기 없는 오리진은 거부됩니다.

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
