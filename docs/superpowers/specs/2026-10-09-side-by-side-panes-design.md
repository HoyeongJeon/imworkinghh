# 나란히 쓰기 설계 문서

- 작성일: 2026-10-09
- 상태: 검토 중
- 바탕 문서: [`2026-10-08-imworkinghh-design.md`](2026-10-08-imworkinghh-design.md). 이 문서에 없는 내용은 바탕 문서를 따른다.

## 1. 목적

글 여러 개를 양옆에 띄워 놓고 함께 쓴다. 예: 초안과 요약본을 동시에 고치기.

- 칸마다 따로 편집하고 따로 저장한다. 한쪽이 읽기 전용인 참고 칸이 아니다.
- 지금은 최대 2칸이다. 나중에 3~5칸으로 늘릴 수 있어야 하므로, 코드는 칸 개수에 묶이지 않게 짓는다. 늘릴 때는 `MAX_PANES` 상수만 바꾼다.

### 성공 기준

1. 두 글을 나란히 띄워 각각 쓰고 저장할 수 있다.
2. 칸이 몇 개여도 쓴 글을 잃지 않는다 (저장 확인, 자동 백업, 복구).
3. 은신 모드에서는 위쪽 가짜 세션이 전체 너비를 그대로 쓰고, 그 아래 글 영역만 나뉜다.
4. `MAX_PANES`를 3으로 바꾸면 다른 코드를 고치지 않아도 세 칸으로 동작한다.
5. 업데이트한 날 기존 설정(`lastFile`)과 기존 형식의 백업 파일이 그대로 이어진다.

## 2. 화면

```
┌ Windows PowerShell ─────────────────────────────┐
│ ● Grep("retryPolicy") ...        (가짜 세션)     │  ← 은신 모드: 전체 너비, 나뉘지 않음
├═════════════════════════╤═══════════════════════┤  ← 위아래 막대 (기존)
│ # 초안                   │ # 요약                 │
│ 본문...                  │ - 핵심 1               │  ← 글 칸 a | b
│                          ║                       │  ← 칸 사이 세로 막대 (끌어서 너비 조절)
├─────────────────────────┴───────────────────────┤
│ 초안.md ●  Ln 2, Col 4 · 340자 · UTF-8          │  ← 상태바: 지금 칸 정보
└─────────────────────────────────────────────────┘
```

- 칸들은 바탕 문서의 에디터 영역(`#editor`) 자리에 가로로 놓인다. 은신 모드를 끄면 가짜 세션이 사라지고 칸들이 화면을 채운다.
- 칸 사이에는 세로 막대가 칸 수 − 1개 있다. 끌면 양옆 두 칸의 너비만 바뀐다.
- 칸은 최소 너비 240px을 지킨다. 창이 좁아 새 칸이 최소 너비를 지킬 수 없으면 칸을 더하지 않는다.
- 커서가 있는 칸이 "지금 칸"이다. 지금 칸을 따로 표시하는 테두리나 색은 넣지 않는다. 은신 모드에서 티가 나지 않게 하려는 것이다. 지금 칸은 커서와 상태바의 파일 이름으로 알 수 있다.
- 줄번호, 문법 색칠, 글꼴 크기, 테마는 모든 칸에 똑같이 적용된다.

## 3. 조작

macOS에서는 `Ctrl`이 `Cmd`로 바뀐다. 단, 칸 이동은 macOS에서도 `Ctrl+Tab`이다 (`Cmd+Tab`은 OS의 앱 전환 키).

| 키 | 동작 |
|---|---|
| `Ctrl+\` | 지금 칸 오른쪽에 빈 새 문서 칸을 더한다. 최대 칸 수거나 창이 좁으면 아무것도 하지 않는다 |
| `Ctrl+W` | 지금 칸을 닫는다. 저장 안 한 변경이 있으면 먼저 묻는다. 칸이 하나뿐이면 아무것도 하지 않는다 |
| `Ctrl+Tab` | 다음 칸으로 커서를 옮긴다 (마지막 칸 다음은 첫 칸) |
| 마우스 클릭 | 클릭한 칸이 지금 칸이 된다 |

- 새 칸을 더하면 지금 칸의 너비를 반으로 나눠 새 칸에 주고, 커서를 새 칸으로 옮긴다.
- 칸을 닫으면 그 너비를 왼쪽 칸에 준다 (첫 칸이면 오른쪽 칸). 커서는 너비를 받은 칸으로 옮긴다.
- 기존 단축키는 지금 칸에 적용된다: 새 문서(`Ctrl+N`), 열기(`Ctrl+O`), 저장(`Ctrl+S`), 다른 이름으로 저장(`Ctrl+Shift+S`).
- 파일을 끌어다 놓으면 놓은 자리의 칸에 연다. 칸 밖(가짜 세션, 상태바)에 놓으면 지금 칸에 연다.
- 다른 프로그램에서 연 파일(탐색기, 두 번째 실행, macOS `open-file`)은 지금 칸에 연다.
- 이미 다른 칸에 열려 있는 파일을 열면, 새로 열지 않고 그 칸으로 커서를 옮긴다. 두 칸이 같은 파일을 따로 저장해 서로 덮어쓰는 일을 막는다. 경로는 Windows와 macOS 모두 대소문자를 구분하지 않고 비교한다 (두 OS의 기본 파일 시스템이 대소문자를 구분하지 않음).
- 상태바와 은신 모드를 끈 상태의 창 제목(`notes.md ● - md-writer`)은 지금 칸의 문서를 따른다. 지금 칸이 바뀌면 바로 바뀐다.

## 4. 저장, 백업, 닫기, 다시 열기

### 4.1 저장

- 칸마다 따로 저장한다. 저장 흐름(대화상자, 확장자, 덮어쓰기 확인, 인코딩)은 바탕 문서 8장과 같다.
- 새 문서, 열기, 저장이 진행 중이면 다른 칸의 명령도 무시한다 (바탕 문서 8.4의 명령 겹침 규칙을 칸 전체에 적용). 대화상자는 한 번에 하나만 뜬다.

### 4.2 자동 백업

- 30초마다 모든 칸의 상태를 백업 파일 하나에 칸 순서대로 쓴다.
  - 저장 안 한 변경이 있는 칸은 내용까지 쓴다.
  - 변경이 없는 칸은 경로만 쓴다. 복구할 때 칸 배치를 그대로 되살리기 위해서다.
  - 저장 안 한 칸이 하나도 없으면 백업 파일을 지운다.
- 형식: `{ savedAt, panes: [{ path, eol, unsavedContent }] }`. `unsavedContent`가 `null`이면 변경 없는 칸이다.
- 어느 칸에서 저장, 열기, 새 문서, 칸 닫기를 하면 그 즉시 백업을 다시 쓰거나 지운다. 다른 칸의 저장 안 한 글은 백업에 남는다.
- 기존 형식(`{ path, content, eol, savedAt }`)의 백업 파일은 칸 하나짜리 새 형식으로 읽는다.

### 4.3 복구

- 시작할 때 백업에 저장 안 한 칸이 있으면 한 번만 묻는다: "저장되지 않은 글이 N개 있습니다. 복구할까요?" (버튼과 Esc 동작은 바탕 문서와 같다. 창을 닫거나 Esc를 누르면 복구한다.)
- 복구하면 백업에 있던 칸 수와 순서대로 칸을 연다.
  - `unsavedContent`가 있는 칸은 그 내용을 넣는다 (변경 있음 상태).
  - 변경 없는 칸은 파일을 다시 연다. 파일이 없어졌으면 그 칸은 빈 새 문서로 연다.
- 백업 칸 수가 `MAX_PANES`보다 많으면 저장 안 한 칸을 우선해서 `MAX_PANES`개까지 연다.

### 4.4 창 닫기

- 저장 안 한 칸이 있으면 왼쪽 칸부터 차례로 그 칸으로 커서를 옮기고 `저장 / 저장 안 함 / 취소`를 묻는다.
- 어느 하나라도 취소하거나 저장 창을 취소하면 창을 닫지 않는다. 이미 저장한 칸은 저장된 채로 둔다.
- 모두 정리되면 백업을 지우고 창을 닫는다.
- 시작이 끝나기 전에 닫으면 바탕 문서처럼 바로 닫는다 (복구 전에는 백업을 지우지 않는다).

### 4.5 다음 실행 때 다시 열기

시작 순서:

1. 백업이 있으면 복구할지 묻는다. 복구하면 4.3대로 연다.
2. 복구하지 않았고 다른 프로그램에서 연 파일이 있으면, 칸 하나에 그 파일만 연다.
3. 둘 다 아니면 마지막에 열려 있던 파일들(`openFiles`)을 칸 순서대로 연다. 없어진 파일은 건너뛰고 조용히 넘어간다. 열 파일이 하나도 없으면 빈 칸 하나로 시작한다.

- 칸 너비 비율(`paneWidths`)은 칸 수가 같을 때만 되살린다. 다르면 같은 너비로 나눈다.

## 5. 설정

- `lastFile: string | null` → `openFiles: string[]` (칸 순서대로, 저장된 적 있는 파일만).
- `paneWidths: number[]` 추가. 칸 너비 비율이며 합은 1이다. 잘못된 값이면 빈 목록으로 바꾸고 같은 너비로 나눈다.
- 예전 설정의 `lastFile`은 읽을 때 `openFiles: [lastFile]`로 옮긴다.
- `openFiles`는 중복 경로와 문자열이 아닌 값을 버리고 `MAX_PANES`개까지만 둔다.

## 6. 코드 구조

### 6.1 원칙

- 칸 개수는 `MAX_PANES` 상수 하나로만 정한다. 다른 코드는 칸을 목록으로 다룬다.
- "칸 하나"를 다루는 모듈과 "칸 여러 개"를 다루는 모듈은 서로의 속을 모른다. 작은 인터페이스로만 주고받는다.
- 연결은 `src/renderer/app.ts`에서만 한다 (바탕 문서 10장 규칙).

### 6.2 새 모듈 (`src/renderer/`)

| 파일 | 역할 | 의존 |
|---|---|---|
| `pane-set.ts` | 칸 목록과 지금 칸 관리 | 없음 (DOM 없음, 칸 종류를 제네릭으로 받음) |
| `document-pane.ts` | 칸 하나 = 에디터 + 문서 상태 + 문서 명령 | `editor`, `document-state`, `document-commands`를 인자로 받은 함수로 조립 |
| `workspace-commands.ts` | 여러 칸에 걸친 흐름: 창 닫기, 칸 닫기, 외부 파일 열기, 복구, 다시 열기 | `PaneSet`과 칸의 작은 인터페이스 |
| `pane-widths.ts` | 칸 너비 비율 계산 | 없음 (순수 함수) |
| `pane-dividers.ts` | 칸 사이 세로 막대 그리기와 끌기 | DOM, `pane-widths` |

```ts
// pane-set.ts
export const MAX_PANES = 2

export type PaneSet<P> = {
  all(): readonly P[]
  focused(): P
  add(): P | null // 최대 칸 수면 null
  remove(pane: P): boolean // 마지막 한 칸이면 false
  focus(pane: P): void
  focusNext(): void
}

export function createPaneSet<P>(options: {
  maxPanes: number
  createPane(): P
  destroyPane(pane: P): void
  onChanged(): void // 칸 추가·삭제·지금 칸 변경
}): PaneSet<P>
```

```ts
// document-pane.ts
export type DocumentPane = {
  element: HTMLElement
  commands: DocumentCommands
  filePath(): string | null
  isDirty(): boolean
  snapshot(): PaneBackup
  status(): PaneStatus // 파일 이름, 변경 여부, 줄, 칸, 글자 수, 인코딩
  focus(): void
  setFontSize(px: number): void
  setSyntaxHighlight(enabled: boolean): void
  setLineNumbersVisible(visible: boolean): void
  destroy(): void
}
```

```ts
// workspace-commands.ts — 칸을 아래 인터페이스로만 다룬다
export type WorkspacePane = {
  filePath(): string | null
  isDirty(): boolean
  focus(): void
  commands: Pick<DocumentCommands, 'confirmClose' | 'openPath' | 'openRequestedFile' | 'restore'>
}

export type WorkspaceCommands = {
  addPane(): boolean
  closeFocusedPane(): Promise<boolean>
  closeWindow(): Promise<boolean>
  openRequestedFile(path: string, target?: WorkspacePane): Promise<boolean>
  restore(backup: BackupSet): Promise<void>
  reopen(paths: string[]): Promise<void>
}
```

```ts
// pane-widths.ts — 너비는 합이 1인 비율 목록
export function equalWidths(count: number): number[]
export function widthsAfterAdd(widths: number[], afterIndex: number): number[]
export function widthsAfterRemove(widths: number[], index: number): number[]
export function widthsAfterDrag(
  widths: number[], dividerIndex: number, pointerRatio: number, minRatio: number,
): number[]
export function canAddPane(count: number, availablePx: number, minPanePx: number): boolean
```

### 6.3 바뀌는 기존 모듈

| 파일 | 변경 |
|---|---|
| `shared/types.ts` | `Backup` → `PaneBackup`, `BackupSet`. `Settings.lastFile` → `openFiles`, `paneWidths` 추가 |
| `shared/settings.ts` | 새 항목 교정, `lastFile` 옮기기 |
| `main/backup-store.ts` | `BackupSet` 읽기/쓰기, 기존 형식 읽기 |
| `main/dialog-options.ts` | 복구 질문에 글 개수 표시 |
| `renderer/document-commands.ts` | `close()` → `confirmClose()` (창을 닫지 않고 이 칸을 닫아도 되는지만 확인). 백업을 직접 지우지 않고 `onBackupStale()`로 알린다. `restoreBackup(backup)` → `restore(paneBackup)`. 명령이 진행 중인지 나타내는 잠금을 직접 갖지 않고 인자로 받아, 모든 칸이 같은 잠금을 쓴다 |
| `renderer/autosave.ts` | 스냅샷이 `BackupSet \| null`. `null`이면 백업을 지운다. `flushNow()` 추가 |
| `renderer/file-drop.ts` | 놓은 자리의 요소를 함께 알린다 |
| `renderer/shortcuts.ts` | `Tab`, `\` 키 이름, 칸 단축키 |
| `renderer/close-handler.ts` | 문서 하나 닫기 대신 `closeWindow()` 사용 |
| `renderer/app.ts` | 에디터·문서 조립을 `document-pane`으로 옮기고, 위 모듈을 연결 |
| `renderer/styles.css` | `#editor` 안에 칸들을 가로로 두는 격자, 세로 막대 |

main의 파일 열기·저장(`file-service`, `documents`)과 IPC는 바뀌지 않는다.

## 7. 오류와 경계

| 상황 | 동작 |
|---|---|
| 칸 닫기 중 저장 창 취소 | 칸을 닫지 않는다 |
| 창 닫기 중 두 번째 칸에서 취소 | 창을 닫지 않는다. 첫 칸에서 저장한 것은 그대로 |
| 다시 열 파일이 없어짐 | 그 칸만 건너뛴다. 오류 창을 띄우지 않는다 |
| 복구할 칸의 원래 파일이 없어짐 | 빈 새 문서 칸으로 연다 |
| 같은 파일을 두 번째 칸에서 열기 | 이미 연 칸으로 커서만 옮긴다 |
| 창이 좁아 칸 최소 너비를 못 지킴 | `Ctrl+\`가 아무것도 하지 않는다. 이미 열린 칸은 비율대로 줄어든다 |
| 명령 진행 중 다른 칸의 명령 | 무시한다 (외부에서 연 파일만 기다렸다가 연다) |

## 8. 기준값

| 항목 | 값 |
|---|---|
| 최대 칸 수 (`MAX_PANES`) | 2 |
| 칸 최소 너비 | 240px |

## 9. 테스트

### 자동 테스트 대상

- `pane-widths`: 같은 너비 나누기, 칸 더하기/빼기 후 비율, 막대 끌기의 최소 너비, 창 너비로 칸 더할 수 있는지 판단. 칸 3개 이상에서도 같은 결과가 나오는지.
- `pane-set`: 최대 칸 수, 마지막 칸 닫기 거부, 지금 칸 이동 순환, 칸 제거 후 지금 칸. 가짜 칸으로 테스트하고 `maxPanes: 3`에서도 확인한다.
- `workspace-commands`: 창 닫기에서 저장 안 한 칸을 차례로 묻고 취소하면 멈추기, 같은 파일은 그 칸으로 이동, 복구와 다시 열기 순서, 없어진 파일 건너뛰기.
- `document-commands`: `confirmClose`, `onBackupStale` 호출 시점.
- `autosave`: 저장 안 한 칸이 없으면 백업을 지우기, `flushNow`.
- `settings`: `lastFile` 옮기기, `openFiles`/`paneWidths` 교정.
- `backup-store`: 새 형식 읽기/쓰기, 기존 형식 읽기.
- `shortcuts`: `Ctrl+\`, `Ctrl+W`, `Ctrl+Tab` 해석과 다른 단축키와 겹치지 않음.
- `file-drop`: 놓은 자리의 요소를 알리기.

### 직접 확인 (앱 실행)

- 칸 더하기/닫기/이동, 막대 끌기, 은신 모드에서 가짜 세션이 나뉘지 않는지.
- 두 칸에 글을 쓰고 앱을 강제 종료한 뒤 복구.
- 두 칸 모두 저장 안 한 상태에서 창 닫기.
- 파일을 오른쪽 칸에 끌어다 놓기.

## 10. 범위 밖

- 탭 (칸 하나에 여러 문서).
- 위아래로 칸 나누기, 같은 문서를 두 칸에서 보기.
- 지금 칸 표시(테두리, 색).
- 칸 순서 바꾸기 (끌어서 옮기기).
