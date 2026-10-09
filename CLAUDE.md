# imworkinghh

터미널에서 Claude Code로 작업하는 것처럼 보이는 마크다운 글쓰기 앱. 위쪽에는 가짜 Claude Code 세션이 흐르고, 아래쪽에서 실제로 글을 쓴다. 은신 모드를 끄면 평범한 마크다운 글쓰기 앱(`md-writer`)으로 보인다. Windows와 macOS를 지원한다.

## 스택

Electron + TypeScript (UI 프레임워크 없음), CodeMirror 6, electron-vite, electron-builder, Vitest (+ jsdom)

## 명령어

`npm run dev` (실행), `npm test` (테스트), `npm run typecheck` (타입 검사), `npm run dist:win` / `npm run dist:mac` (빌드). 자세한 내용은 [`docs/build.md`](docs/build.md).

## 개발 규칙

예시와 자세한 설명은 [`docs/conventions.md`](docs/conventions.md)에 있다.

**개발 방식**
- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다 (TDD).
- `describe`는 한국어 명사, `it`은 "~하면 ~한다" 형태의 한국어 문장으로 쓴다.
- 테스트 파일은 `tests/`에 `src/`와 같은 경로로 둔다.

**코드**
- 이름만 보고 역할을 알 수 있게 짓는다. 주석은 코드로 드러나지 않는 "왜"가 있을 때만 쓴다.
- 모듈은 의존 대상을 인자로 받는다. 다른 화면 모듈을 직접 import해서 호출하지 않는다 (타입 import는 허용). 연결은 `src/main/index.ts`와 `src/renderer/app.ts`에서만 한다.

**Electron**
- 모든 npm 패키지는 `devDependencies`에 넣는다. renderer 코드는 Vite가 번들하므로 앱 패키지에 node_modules가 필요 없다.
- `package.json`에 `"type": "module"`을 넣지 않는다. sandbox preload는 CommonJS여야 한다.
- BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- 디스크 접근은 main 프로세스에서만 한다. renderer는 preload가 노출한 `ImworkingApi`만 쓴다.

**저장**
- 항상 UTF-8 (BOM 없음)로 저장한다.
- 임시 파일에 쓴 뒤 교체한다. `EPERM`/`EBUSY`/`EACCES`면 최대 5번 재시도한다.

**기록과 Git**
- 결정을 내리면 `DECISIONLOG.md`에 기록한다. 에이전트 메모리에 의존하지 않는다.
- 커밋 메시지는 한국어로, 제목과 본문만 쓴다.

## 제품 기준값

설계 문서에서 정한 값이다. 바꾸려면 설계 문서와 함께 고친다.

| 항목 | 값 |
|---|---|
| 가짜 세션 최대 줄 수 | 3000줄 |
| 분할 영역 최소 크기 | 80px |
| 자동 백업 주기 | 30초 |
| 큰 파일 기준 | 10MB |
| 상태바 글자수 다시 세기 | 입력이 150ms 멈췄을 때 |
| 나란히 쓰기 최대 칸 수 / 칸 최소 너비 | 2칸 / 240px |
| 로그 속도 배율 | 느림 1.6 / 보통 1.0 / 빠름 0.5 |
| 타이핑 연동 | 마지막 입력 후 3초 이내면 배율 0.5, 15초 넘게 입력이 없으면 쉬는 상태 |
| 글꼴 | `'Cascadia Mono', Consolas, Menlo, 'D2Coding', 'Malgun Gothic', 'Apple SD Gothic Neo', monospace` |

## 문서

| 문서 | 내용 |
|---|---|
| [`DECISIONLOG.md`](DECISIONLOG.md) | 지금까지 내린 결정, 고려한 대안, 이유 |
| [`docs/conventions.md`](docs/conventions.md) | 개발 규칙의 예시와 자세한 설명 |
| [`docs/build.md`](docs/build.md) | 개발 실행, Windows/macOS 빌드, 바로가기, 파일 연결 등록, 설정/백업 파일 위치 |
| [`docs/superpowers/specs/2026-10-08-imworkinghh-design.md`](docs/superpowers/specs/2026-10-08-imworkinghh-design.md) | 설계: 화면, 단축키, 가짜 세션, 에디터, 테마, 저장, 설정, 모듈 구조, 테스트 대상 |
| [`docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md`](docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md) | 나란히 쓰기 설계: 칸 조작, 저장·백업·복구, 칸 구조 |
| [`docs/superpowers/plans/2026-10-08-imworkinghh.md`](docs/superpowers/plans/2026-10-08-imworkinghh.md) | 첫 구현 계획 (Task 1~20) |
| [`docs/superpowers/plans/2026-10-09-side-by-side-panes.md`](docs/superpowers/plans/2026-10-09-side-by-side-panes.md) | 나란히 쓰기 구현 계획 (Task 1~11) |
