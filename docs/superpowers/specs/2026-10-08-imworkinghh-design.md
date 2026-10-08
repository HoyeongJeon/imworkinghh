# imworkinghh 설계 문서

- 작성일: 2026-10-08
- 상태: 승인 대기

## 1. 목적

마크다운/텍스트 글쓰기 앱. 겉보기에는 **터미널에서 Claude Code로 작업 중인 화면**처럼 보여야 한다.

- 위쪽: 가짜 Claude Code 세션이 계속 흘러간다 (연출용, 실제로 아무것도 실행하지 않음).
- 아래쪽: 사용자가 실제로 글을 쓰는 에디터.
- 두 영역의 경계는 마우스로 드래그해 크기를 조절한다.

### 성공 기준

1. 옆에서 화면을 봤을 때 터미널에서 개발 작업을 하는 것처럼 자연스럽게 보인다.
2. 한글 글쓰기가 메모장/Obsidian 수준으로 편하고 안정적이다.
3. 쓴 글은 절대 잃지 않는다 (안전한 저장, 자동 백업, 복구).
4. Windows와 macOS에서 동작한다.

## 2. 기술 구성

| 구분 | 선택 |
|---|---|
| 앱 | Electron + TypeScript (UI 프레임워크 없이 순수 TS) |
| 에디터 | CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`) |
| 빌드/개발 | `electron-vite` |
| 패키징 | `electron-builder` (Windows: exe, macOS: dmg) |
| 테스트 | Vitest |

- 에디터를 뺀 나머지(가짜 세션, 분할창, 제목줄, 상태바, 설정 창, 테마, 단축키, 저장 로직)는 직접 구현한다.
- macOS용 빌드는 사용자의 맥에서 `npm run dist:mac` 한 줄로 만든다. 서명은 하지 않으며, 처음 실행할 때 우클릭 → 열기로 허용한다.
- Windows exe 바로가기는 `C:\Users\홍길동\Desktop\09_앱_바로가기`에 만든다.

## 3. 화면 구성

```
┌─ [가짜 터미널 제목줄] ──────────────────────────────┐
│ PS C:\dev\payments-api> claude                      │
│ ● Grep("retryPolicy", src/)                         │
│   ⎿ Found 7 matches                                 │  ← 가짜 세션 영역 (읽기 전용, 자동 스크롤)
│ ✻ Thinking… (12s)                                   │
├═════════════════════════════════════════════════════┤  ← 드래그해서 크기 조절
│  1 │ # 회의록 10/08                                  │
│  2 │ - **결정**: 배포 금요일                          │  ← 에디터 (줄번호 + 문법 색칠)
├─────────────────────────────────────────────────────┤
│ notes.md ●  Ln 3, Col 1  ·  128자  ·  UTF-8         │  ← 상태바
└─────────────────────────────────────────────────────┘
```

- 메뉴바는 없다. 조작은 단축키와 설정 창으로만 한다.
  - 예외: macOS에서는 메뉴가 없으면 Cmd+C/V가 동작하지 않으므로, 최소한의 앱 메뉴(편집 역할 포함)를 만들고 macOS 메뉴바에만 보이게 한다.
- 창 테두리를 직접 그린다.
  - Windows 계열 테마: Windows Terminal 스타일 탭 제목줄 (`⚡ Windows PowerShell ×  +  ∨`)과 최소화/최대화/닫기 버튼
  - macOS 계열 테마: 기본 신호등 버튼을 유지하고 가운데에 `user — claude — 80×24` 스타일 제목
- OS 창 제목(작업 표시줄, Alt+Tab)은 테마 이름으로 위장한다 (예: `Windows PowerShell`). 파일명은 상태바에만 표시한다.
- 분할 비율은 종료 시 저장했다가 다음 실행 때 복원한다.
- 드래그할 때 위아래 영역은 각각 최소 80px을 유지한다. 패닉 키로 접을 때만 에디터 영역이 0이 된다.

## 4. 단축키

macOS에서는 `Ctrl`이 `Cmd`로 바뀐다.

| 키 | 동작 |
|---|---|
| `Ctrl+N` / `Ctrl+O` | 새 문서 / 열기 |
| `Ctrl+S` / `Ctrl+Shift+S` | 저장 / 다른 이름으로 저장 |
| `Ctrl+,` | 설정 창 |
| `` Ctrl+` `` (Windows), `Cmd+Shift+.` (macOS) | 패닉 키. 설정에서 다른 키로 바꿀 수 있다 |
| `Ctrl+Shift+H` | 문법 색칠 켜기/끄기 |
| `Ctrl+Shift+P` | 가짜 세션 일시정지/재개 |
| `Ctrl+Shift+T` | 테마 순환 |
| `Ctrl+휠`, `Ctrl+=`, `Ctrl+-` | 글꼴 크기 |

## 5. 가짜 Claude Code 세션

### 5.1 생성기 (`renderer/fake/scenario.ts`)

DOM에 의존하지 않는 순수 모듈이다. 시드를 받는 난수 생성기로 이벤트를 끝없이 만들어 낸다.

이벤트 종류:

| 이벤트 | 설명 |
|---|---|
| `TypeOut { text, role, charDelayMs }` | 한 글자씩 타이핑되듯 출력 (사용자 프롬프트 입력 연출) |
| `Line { segments[], delayMs }` | 한 줄 출력. `segments`는 `{ text, role }` 목록. `delayMs`는 다음 이벤트까지 대기 시간 |
| `Spinner { label, durationMs }` | 같은 줄에서 경과 초가 올라가는 애니메이션 (`✻ Thinking… (12s)`) |

`role`은 색을 결정하는 의미 단위다: `prompt`, `userInput`, `toolBullet`, `toolName`, `toolArg`, `result`, `diffAdd`, `diffRemove`, `thinking`, `success`, `muted`.

작업 하나의 흐름:

1. 프로젝트 선택 (`pools.ts`의 프로젝트 이름 목록)
2. 테마 프롬프트 출력 후 작업 요청을 타이핑 (`> fix the flaky retry test in billing`)
3. Thinking 스피너
4. 도구 호출 4~10개를 섞어서 출력: `Grep`, `Glob`, `Read`, `Update`(diff 포함), `Write`, `Bash`(테스트/빌드 결과), `WebSearch`, `WebFetch`, Todo 갱신
5. 요약 줄 (`✓ 42 tests passing` 등)
6. 다음 작업으로 이동

재료(프로젝트명, 파일 경로, 함수명, 검색어, diff 조각, 테스트 이름)는 `renderer/fake/pools.ts`에 모으고, 조합해서 반복이 티 나지 않게 한다.

프롬프트 문자열은 테마가 정한다. 생성기는 프롬프트를 만드는 함수를 주입받는다.

### 5.2 출력기 (`renderer/fake/player.ts`)

- 타이머로 이벤트를 하나씩 꺼내 위쪽 영역에 `<span class="role-...">`로 출력한다. 실제 색은 테마의 CSS 변수가 정한다.
- 최대 3000줄을 유지하고 오래된 줄부터 지운다.
- 사용자가 위로 스크롤해 둔 상태면 자동 스크롤을 멈추고, 맨 아래로 돌아오면 다시 자동 스크롤한다.

### 5.3 옵션 (모두 설정에서 켜고 끌 수 있음)

| 옵션 | 동작 |
|---|---|
| 로그 속도 | 느림 / 보통 / 빠름에 따라 대기 시간에 1.6 / 1.0 / 0.5배를 곱한다 |
| 타이핑 연동 | 마지막 키 입력 후 3초 이내면 대기 시간을 0.5배로 줄인다. 15초 넘게 입력이 없으면 긴 Thinking 스피너로 들어간다 |
| 일시정지 | 타이머만 멈추고, 재개하면 멈춘 위치부터 이어간다 (설정에 저장하지 않음) |
| 패닉 키 | 현재 분할 비율을 기억하고 에디터 영역을 0으로 접는다. 다시 누르면 기억한 비율로 복원한다 |
| 문법 색칠 | 끄면 에디터가 단색 텍스트로 보인다 |

## 6. 에디터 (`renderer/editor.ts`)

- CodeMirror 6, 줄번호 표시, 줄바꿈(soft wrap) 켬.
- 마크다운 문법 색칠: 기호(`#`, `**`, `-`, `` ` ``)는 그대로 보이고 색만 입힌다. 코드블록 안은 언어별로 색칠한다.
- 문법 색칠은 CodeMirror `Compartment`로 켜고 끈다.
- 키 입력이 있을 때마다 타이핑 이벤트를 내보낸다 (타이핑 연동용).
- 문서 변경, 커서 위치, 글자수를 상태바에 알린다.

## 7. 테마 (`renderer/themes.ts`)

| ID | 이름 | 배경 | 프롬프트 | 제목줄 |
|---|---|---|---|---|
| `windows-terminal` | Windows Terminal | `#0C0C0C` | `PS C:\dev\{project}>` | windows |
| `powershell` | PowerShell | `#012456` | `PS C:\dev\{project}>` | windows |
| `cmd` | CMD | `#000000` | `C:\dev\{project}>` | windows |
| `wsl-ubuntu` | WSL Ubuntu | `#300A24` | `user@DESKTOP:~/{project}$` | windows |
| `macos-basic` | macOS Basic | `#1E1E1E` | `user@MacBook-Pro {project} %` | mac |
| `macos-homebrew` | macOS Homebrew | `#000000` (초록 글씨) | `user@MacBook-Pro {project} %` | mac |

- 테마는 CSS 변수 묶음(배경, 글자, 각 `role` 색, 에디터 색, 선택 영역, 커서), 프롬프트 템플릿, OS 창 제목, 제목줄 종류로 이루어진다.
- 기본 테마: Windows는 `windows-terminal`, macOS는 `macos-basic`.
- 글꼴: `Cascadia Mono`, `Consolas`, `Menlo`, `monospace` 순서. 한글은 `D2Coding`, `Malgun Gothic`, `Apple SD Gothic Neo` 순서로 대체한다.

## 8. 저장과 파일 처리 (`main/files.ts`)

디스크 접근은 main 프로세스에서만 한다. renderer는 preload가 노출한 API만 쓴다.

### 8.1 형식

- 저장 창에 `Markdown (*.md)`, `Text (*.txt)` 필터를 둔다. 마지막에 고른 형식이 기본 선택이다.
- 파일 이름에 확장자가 없으면 고른 형식의 확장자를 붙인다.
- 이미 경로가 있는 문서에서 `Ctrl+S`를 누르면 대화상자 없이 같은 경로에 저장한다.

### 8.2 안전한 쓰기

1. 같은 폴더에 임시 파일(`.{파일명}.{난수}.tmp`)을 쓴다.
2. 원래 경로로 이름을 바꿔 교체한다.
3. Windows에서 `EPERM`/`EBUSY`가 나면 짧은 간격으로 최대 5번 재시도한다.
4. 끝까지 실패하면 임시 파일을 지우고 오류를 돌려준다.

### 8.3 인코딩과 줄바꿈

- 저장은 항상 UTF-8 (BOM 없음).
- 읽을 때 감지 순서: UTF-8 BOM → UTF-16 LE/BE BOM → 올바른 UTF-8 → CP949(`euc-kr`)로 해석.
- 원래 파일의 줄바꿈(CRLF/LF)을 감지해서 저장할 때 그대로 쓴다. 새 문서는 OS 기본값(Windows CRLF, macOS LF)을 쓴다.
- 상태바에 읽은 인코딩을 표시한다. UTF-8이 아니었으면 `CP949 → UTF-8`처럼 저장 시 바뀐다는 것을 보여 준다.

### 8.4 변경 여부

- 마지막으로 저장(또는 연) 내용과 현재 내용을 비교해서 판단한다. 고쳤다가 원래대로 되돌리면 변경 없음이 된다.
- 변경이 있는 상태에서 창 닫기, 새 문서, 열기를 하면 `저장` / `저장 안 함` / `취소`를 묻는다.

### 8.5 자동 백업과 복구

- 변경이 있고 마지막 백업 이후 내용이 바뀌었으면 30초마다 `{userData}/backup/current.json`에 `{ path, content, eol, savedAt }`를 쓴다.
- 정상 저장하거나 변경 없이 종료하면 백업을 지운다.
- 시작할 때 백업이 있으면 복구할지 묻는다.
- 마지막으로 연 파일은 다음 실행 때 다시 연다 (파일이 없어졌으면 조용히 새 문서로 시작).

### 8.6 오류 처리

| 상황 | 동작 |
|---|---|
| 저장 실패 (권한, 읽기 전용, 디스크 꽉 참) | 이유를 알리는 대화상자. 문서는 변경 상태로 남고 백업은 유지 |
| 열기 실패 | 이유를 알리고 현재 문서는 그대로 둠 |
| 10MB 이상 파일 | 열기 전에 확인 |

## 9. 설정 (`main/settings.ts`)

- 위치: `{userData}/settings.json` (Windows `%APPDATA%\imworkinghh`, macOS `~/Library/Application Support/imworkinghh`)
- 항목: `theme`, `syntaxHighlight`, `panicEnabled`, `panicKey`, `typingLink`, `logSpeed`, `fontSize`, `splitRatio`, `windowBounds`, `lastDirectory`, `lastFile`, `defaultFormat`
- 불러올 때 기본값과 병합한다. 알 수 없는 키는 버리고, 타입이 틀린 값은 기본값으로 바꾼다.
- 파일이 깨져 있으면 `settings.bad.json`으로 옮기고 기본값으로 시작한다.

## 10. 모듈 구조

```
src/
├─ main/
│  ├─ index.ts          창 생성, 닫기 전 저장 확인
│  ├─ files.ts          대화상자, 읽기/쓰기, 인코딩, 안전한 쓰기, 백업
│  ├─ settings.ts       설정 저장/불러오기
│  └─ menu.ts           macOS 전용 최소 메뉴
├─ preload/index.ts     contextBridge로 API 노출
├─ shared/types.ts      Settings, ThemeId, IPC 타입
└─ renderer/
   ├─ main.ts           조립
   ├─ titlebar.ts       가짜 터미널 제목줄
   ├─ splitter.ts       드래그 크기 조절, 패닉 접기/복원
   ├─ editor.ts         CodeMirror 설정
   ├─ statusbar.ts      파일명, ●, 줄/칸, 글자수, 인코딩
   ├─ themes.ts         테마 정의
   ├─ shortcuts.ts      단축키
   ├─ settings-dialog.ts 설정 창
   ├─ fake/
   │  ├─ scenario.ts    이벤트 생성기
   │  ├─ pools.ts       재료 목록
   │  └─ player.ts      출력기
   └─ styles.css
```

Electron 보안 설정: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

순수 로직(인코딩 감지, 줄바꿈 처리, 확장자 처리, 설정 병합, 변경 여부, 분할 비율 계산, 속도 배율, 생성기)은 Electron/DOM과 분리된 함수로 만들어 단위 테스트한다.

## 11. 개발 방식: TDD

- 모든 기능은 **실패하는 테스트를 먼저 작성**하고, 실패하는 것을 확인한 다음 구현한다.
- 테스트 이름만 읽어도 그 모듈이 무엇을 하는지 알 수 있어야 한다.
  - `describe`는 대상을 한국어 명사로 쓴다. 예: `describe('파일 저장 형식')`
  - `it`은 "~하면 ~한다" 형태의 한국어 문장으로 행동을 쓴다. 예: `it('확장자 없이 저장하면 고른 형식의 확장자를 붙인다')`
  - 구현 세부(함수명, 내부 변수)가 아니라 사용자/호출자가 관찰하는 결과를 쓴다.
- 테스트 파일은 `tests/` 아래에 대상 모듈과 같은 경로로 둔다. 예: `tests/main/files.test.ts`

### 자동 테스트 대상

- 가짜 세션 생성기: 같은 시드면 같은 결과, 이벤트 형식, 작업 흐름 순서, 프롬프트 주입
- 출력기의 순수 부분: 속도 배율, 타이핑 연동 상태, 최대 줄 수 유지
- 분할: 드래그 비율 계산과 최소 크기 제한, 패닉 접기/복원
- 파일: 인코딩 감지, 줄바꿈 감지/유지, 확장자 처리, 안전한 쓰기(실제 임시 폴더), 백업 쓰기/읽기/삭제
- 설정: 기본값 병합, 잘못된 값 교정, 깨진 파일 처리
- 문서 상태: 변경 여부 판단
- 테마: 모든 테마에 필요한 색 변수가 빠짐없이 있는지, 프롬프트 템플릿 치환

### 직접 확인 (앱 실행)

드래그 크기 조절, 패닉 키, 한글 입력, 테마 전환, 문법 색칠 토글, 저장 → 다시 열기, 강제 종료 후 복구.

## 12. 범위 밖

- 미리보기 렌더링, 파일 탐색 사이드바, 여러 탭 문서
- 코드 서명, 자동 업데이트
- 가짜 세션이 실제 명령을 실행하는 기능
