# imworkinghh

터미널에서 Claude Code로 작업하는 것처럼 보이는 마크다운 글쓰기 앱. 위쪽에는 가짜 Claude Code 세션이 흐르고, 아래쪽에서 실제로 글을 쓴다. Windows와 macOS를 지원한다.

## 필수 정보

- 스택: Electron + TypeScript (UI 프레임워크 없음), CodeMirror 6, electron-vite, electron-builder, Vitest
- 개발은 TDD로 한다. 테스트를 먼저 쓰고, 테스트 이름은 한국어 행동 문장으로 쓴다.
- 이름으로 설명하고 주석은 최소로 쓴다. 모듈은 의존 대상을 인자로 받아 느슨하게 연결한다.
- 결정을 내리면 `DECISIONLOG.md`에 기록한다. 에이전트 메모리에 의존하지 않는다.
- 디스크 접근은 main 프로세스에서만 한다. renderer는 preload가 노출한 API만 쓴다.

## 문서

| 문서 | 내용 |
|---|---|
| [`DECISIONLOG.md`](DECISIONLOG.md) | 지금까지 내린 결정, 고려한 대안, 이유 |
| [`docs/conventions.md`](docs/conventions.md) | TDD 순서, 테스트 이름과 위치, 이름·주석·결합 규칙, 문서와 Git 규칙 |
| [`docs/superpowers/specs/2026-10-08-imworkinghh-design.md`](docs/superpowers/specs/2026-10-08-imworkinghh-design.md) | 설계: 화면, 단축키, 가짜 세션, 에디터, 테마, 저장, 설정, 모듈 구조, 테스트 대상 |
