# 나란히 쓰기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 글 칸을 양옆에 띄워 칸마다 따로 쓰고 저장한다 (`|a글|b글|`). 지금은 최대 2칸이고, `MAX_PANES` 상수 하나만 바꾸면 칸 수를 늘릴 수 있다.

**Architecture:** "칸 하나"(`document-pane`: 에디터 + 문서 상태 + 문서 명령)와 "칸 여러 개"(`pane-set`: 목록과 지금 칸, `workspace-commands`: 창 닫기·복구·다시 열기 같은 여러 칸 흐름)를 나누고, 작은 인터페이스로만 주고받는다. 너비 계산(`pane-widths`)은 순수 함수, 막대 그리기(`pane-dividers`)는 DOM 모듈이다. 모든 칸은 명령 겹침 잠금(`command-lock`) 하나를 함께 쓴다. 연결은 `src/renderer/app.ts`에서만 한다.

**Tech Stack:** Electron 44, TypeScript, CodeMirror 6, electron-vite, Vitest (+ jsdom)

**Spec:** `docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md` (바탕 문서: `docs/superpowers/specs/2026-10-08-imworkinghh-design.md`)

## Global Constraints

모든 Task는 [`CLAUDE.md`](../../../CLAUDE.md)의 **개발 규칙**과 **제품 기준값**을 따른다. 특히:

- TDD: 실패하는 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다. `describe`는 한국어 명사, `it`은 "~하면 ~한다" 형태.
- 주석은 코드로 드러나지 않는 "왜"만 쓴다.
- 모듈은 의존 대상(DOM, 타이머, API, 다른 화면 모듈의 생성 함수)을 인자로 받는다. 순수 함수 import는 허용한다 (예: `editor.ts` → `visual-lines.ts`).
- 기준값: 최대 칸 수 `MAX_PANES = 2`, 칸 최소 너비 `240px`, 상태바 글자수 다시 세기 `150ms`, 자동 백업 `30초`.
- 커밋 메시지는 한국어, 제목과 본문만. `Co-Authored-By` 같은 AI 표시를 넣지 않는다. 저장소에 user.name/user.email을 설정하지 않는다.
- Git Bash에서 Node를 쓰려면 먼저 `export PATH="/c/Program Files/nodejs:$PATH"`.
- 모든 Task의 마지막 커밋 전에 `npm test`와 `npm run typecheck`가 둘 다 통과해야 한다. 중간 Task에서 `app.ts`를 잠깐 맞춰 고치는 부분("임시 연결")은 Task 11에서 통째로 바뀐다.

## Review Focus

스펙이 직접 말하지 않지만 실제로 쓰다가 문제가 되기 쉬운 상황이다. 각 항목의 테스트는 해당 Task에 들어 있다.

1. 업데이트한 날 예전 형식 백업(`{ path, content, eol, savedAt }`)과 예전 설정(`lastFile`)이 그대로 이어져야 한다 → Task 4 `예전 설정의 마지막 파일은 열린 파일 목록으로 옮긴다`, Task 5 `예전 형식의 백업은 칸 하나짜리 백업으로 읽는다`
2. 창 닫기 중 첫 칸은 저장하고 둘째 칸에서 취소하면, 첫 칸의 글이 다음 실행 때 복구 질문에 다시 나오면 안 된다 (자동 백업이 멈춘 뒤에도 백업을 고쳐 써야 한다) → Task 5 `멈춘 뒤에도 바로 백업하라고 하면 백업한다`
3. 칸을 닫으며 "저장 안 함"을 고르면 그 칸의 글이 다음 실행 때 복구되면 안 된다 → Task 9 `지금 칸을 닫으면 저장 확인을 거쳐 없애고 남은 칸으로 커서를 옮긴 뒤 백업을 고쳐 쓰게 한다`
4. 은신 모드에서 새로 더한 칸에 줄번호가 보이면 안 된다 → Task 8 `처음 받은 글꼴 크기와 줄 번호 표시로 시작한다`
5. 같은 파일을 대소문자만 다른 경로로 두 칸에 열면 서로 덮어쓴다 → Task 3 `대소문자만 다른 경로는 같은 파일로 본다`, Task 9 `다른 칸에 같은 파일이 열려 있으면 그 칸으로 옮긴다`

## 파일 구조

| Task | 만들기 | 고치기 |
|---|---|---|
| 1 | | 설계 문서 2개, `DECISIONLOG.md` |
| 2 | `src/renderer/pane-widths.ts` | |
| 3 | `src/shared/panes.ts`, `src/renderer/pane-set.ts` | |
| 4 | | `src/shared/types.ts`, `src/shared/settings.ts`, `src/renderer/app.ts`(임시) |
| 5 | | `src/shared/types.ts`, `src/shared/api.ts`, `src/main/backup-store.ts`, `src/main/dialog-options.ts`, `src/main/dialogs.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/renderer/document-state.ts`, `src/renderer/autosave.ts`, `src/renderer/document-commands.ts`, `src/renderer/app.ts`(임시) |
| 6 | `src/renderer/command-lock.ts` | `src/renderer/document-commands.ts`, `src/renderer/close-handler.ts`, `src/renderer/app.ts`(임시) |
| 7 | | `src/renderer/shortcuts.ts`, `src/renderer/file-drop.ts` |
| 8 | `src/renderer/document-pane.ts` | `src/renderer/editor.ts`, `src/renderer/app.ts`(임시) |
| 9 | `src/renderer/workspace-commands.ts` | |
| 10 | `src/renderer/pane-dividers.ts` | `src/renderer/styles.css` |
| 11 | | `src/renderer/app.ts` |

테스트는 `tests/` 아래 같은 경로에 둔다.

---

### Task 1: 설계 문서 보완

계획을 세우며 정한 세부를 코드보다 먼저 설계 문서에 반영한다 (`docs/conventions.md`: 설계가 바뀌면 코드보다 설계 문서를 먼저 고친다).

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md`
- Modify: `docs/superpowers/specs/2026-10-08-imworkinghh-design.md`
- Modify: `DECISIONLOG.md`

**Interfaces:** 없음 (문서만)

- [ ] **Step 1: 나란히 쓰기 설계 문서 고치기**

`docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md`에서 아래를 바꾼다.

(a) 4번째 줄 `- 상태: 검토 중` → `- 상태: 확정`

(b) 1장 `늘릴 때는 \`MAX_PANES\` 상수만 바꾼다.` → `늘릴 때는 \`src/shared/panes.ts\`의 \`MAX_PANES\` 상수만 바꾼다.`

(c) 6.2 표 아래쪽에 두 줄을 더한다 (`pane-dividers.ts` 줄 다음):

```markdown
| `command-lock.ts` | 명령 겹침 잠금. 모든 칸이 하나를 함께 쓴다 | 없음 |
```

그리고 표 바로 아래에 문단을 더한다:

```markdown
`MAX_PANES`와 경로 비교(`isSamePath`)는 설정 교정(`shared/settings.ts`)에서도 쓰므로 `src/shared/panes.ts`에 둔다.
```

(d) `pane-set.ts` 코드 블록을 아래로 바꾼다:

```ts
// pane-set.ts
export type PaneChange =
  | { kind: 'added'; index: number }
  | { kind: 'removed'; index: number }
  | { kind: 'focused' }

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
  onChanged(change: PaneChange): void // 칸 추가·삭제·지금 칸 변경. 너비 계산에 쓰도록 위치를 알린다
}): PaneSet<P>
```

(e) `document-pane.ts` 코드 블록 바로 아래에 문단을 더한다:

```markdown
에디터, 문서 상태, 문서 명령, 지연 실행을 만드는 함수는 `parts`로 받는다. 칸을 만들 때 글꼴 크기·문법 색칠·줄번호 표시를 함께 받아, 은신 모드에서 새로 더한 칸에도 줄번호가 보이지 않게 한다.
```

(f) `workspace-commands.ts` 코드 블록의 `WorkspaceCommands`를 아래로 바꾼다:

```ts
export type WorkspaceCommands = {
  addPane(): boolean
  closeFocusedPane(): Promise<boolean>
  closeWindow(): Promise<boolean>
  focusPaneWithFile(path: string, except: WorkspacePane): boolean
  openRequestedFile(path: string, target?: WorkspacePane): Promise<boolean>
  restore(backup: BackupSet): Promise<void>
  reopen(paths: readonly string[]): Promise<void>
}
```

(g) `pane-widths.ts` 코드 블록을 아래로 바꾼다:

```ts
// pane-widths.ts — 너비는 합이 1인 비율 목록
export const MIN_PANE_WIDTH_PX = 240
export function equalWidths(count: number): number[]
// 반으로 나눈 너비가 minRatio보다 좁으면 모든 칸을 같은 너비로 나눈다 (3칸 이상에서 좁은 칸을 나눌 때)
export function widthsAfterAdd(widths: readonly number[], afterIndex: number, minRatio: number): number[]
export function widthsAfterRemove(widths: readonly number[], index: number): number[]
export function widthsAfterDrag(
  widths: readonly number[], dividerIndex: number, pointerRatio: number, minRatio: number,
): number[]
export function canAddPane(count: number, availablePx: number, minPanePx: number): boolean
```

(h) 6.3 표에서 `renderer/document-commands.ts` 줄 끝에 ` 다른 칸에 이미 열린 파일인지 \`focusIfOpenElsewhere(path)\`로 묻고, 열려 있으면 열지 않는다.`를 더한다. 그리고 표에 두 줄을 더한다:

```markdown
| `renderer/editor.ts` | 처음 보기 설정(글꼴 크기, 줄번호 표시)을 받는다. `destroy()` 추가 |
| `shared/api.ts`, `main/dialogs.ts`, `main/ipc.ts`, `preload/index.ts` | 복구 질문에 저장 안 한 글 개수를 넘긴다 |
```

(i) 표 아래 `main의 파일 열기·저장(\`file-service\`, \`documents\`)과 IPC는 바뀌지 않는다.` → `main의 파일 열기·저장(\`file-service\`, \`documents\`)은 바뀌지 않는다. IPC는 복구 질문에 글 개수를 더하는 것만 바뀐다.`

- [ ] **Step 2: 바탕 설계 문서 고치기**

`docs/superpowers/specs/2026-10-08-imworkinghh-design.md`:

(a) 4장 단축키 표에서 `| \`Ctrl+Shift+M\` | 은신 모드 켜기/끄기 |` 줄 다음에 더한다:

```markdown
| `Ctrl+\` | 지금 칸 오른쪽에 새 칸 (나란히 쓰기) |
| `Ctrl+W` | 지금 칸 닫기 |
| `Ctrl+Tab` | 다음 칸으로 (macOS도 `Ctrl+Tab`) |
```

(b) 8.4의 `- 새 문서, 열기, 저장, 닫기가 진행 중이면(대화상자가 떠 있는 동안 등) 다시 들어온 명령은 무시한다.` → `- 새 문서, 열기, 저장, 닫기가 진행 중이면(대화상자가 떠 있는 동안 등) 다시 들어온 명령은 무시한다. 나란히 쓰기의 모든 칸이 이 규칙을 함께 쓴다.`

(c) 8.5의 첫 줄과 마지막 줄을 바꾼다:

- `- 변경이 있고 마지막 백업 이후 내용이 바뀌었으면 30초마다 \`{userData}/backup/current.json\`에 \`{ path, content, eol, savedAt }\`를 쓴다.` → `- 마지막 백업 이후 내용이 바뀌었으면 30초마다 \`{userData}/backup/current.json\`에 모든 칸의 상태를 \`{ savedAt, panes: [{ path, eol, unsavedContent }] }\`로 쓴다. 저장 안 한 칸이 하나도 없으면 백업을 지운다 (나란히 쓰기 설계 4.2).`
- `- 마지막으로 연 파일은 다음 실행 때 다시 연다 (파일이 없어졌으면 조용히 새 문서로 시작).` → `- 마지막에 열려 있던 파일들은 다음 실행 때 칸 순서대로 다시 연다 (없어진 파일은 조용히 건너뛴다).`

(d) 9장 항목 줄의 `` `lastDirectory`, `lastFile`, `defaultFormat` `` → `` `lastDirectory`, `openFiles`, `paneWidths`, `defaultFormat` ``. 그리고 `(글꼴 크기, 마지막 파일)` → `(글꼴 크기, 열린 파일 목록)`.

(e) 10장 모듈 트리:
- `│  ├─ types.ts                Settings, ThemeId, Eol, Backup 등 기본 타입` → `│  ├─ types.ts                Settings, ThemeId, Eol, PaneBackup, BackupSet 등 기본 타입`
- `│  ├─ settings.ts             설정 기본값과 교정` 다음 줄에 `│  ├─ panes.ts                최대 칸 수, 경로 비교` 추가
- `   ├─ document-commands.ts    새 문서/열기/저장/닫기 흐름, 명령 겹침 막기` → `   ├─ document-commands.ts    칸 하나의 새 문서/열기/저장/닫기 확인 흐름` 그리고 다음 줄들 추가:

```
   ├─ command-lock.ts         명령 겹침 막기 (모든 칸이 함께 씀)
   ├─ document-pane.ts        칸 하나: 에디터 + 문서 상태 + 문서 명령
   ├─ pane-set.ts             칸 목록과 지금 칸
   ├─ workspace-commands.ts   여러 칸 흐름: 창 닫기, 칸 닫기, 복구, 다시 열기
   ├─ pane-widths.ts          칸 너비 비율 계산
   ├─ pane-dividers.ts        칸 배치와 칸 사이 세로 막대 (DOM)
```

- [ ] **Step 3: DECISIONLOG의 D-027을 확정으로**

`DECISIONLOG.md`의 D-027에서:
- `- 2026-10-09 / 설계 검토 중` → `- 2026-10-09 / 확정`
- `- 결정:` 줄 끝(`자세한 내용은 ... .` 앞)에 `명령 겹침 잠금은 \`command-lock.ts\`로 떼어 모든 칸이 하나를 함께 쓰고, \`MAX_PANES\`는 설정 교정에서도 쓰므로 \`src/shared/panes.ts\`에 둔다. ` 를 넣는다.

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers/specs/2026-10-09-side-by-side-panes-design.md docs/superpowers/specs/2026-10-08-imworkinghh-design.md DECISIONLOG.md
git commit -m "docs: 나란히 쓰기 설계 확정과 세부 반영 (D-027)" -m "칸 변경 알림의 위치 정보, 공용 명령 잠금, MAX_PANES 위치, 복구 질문의 글 개수를 설계 문서에 적고 바탕 설계 문서의 단축키·백업·설정·모듈 목록을 맞춘다."
```

---

### Task 2: 칸 너비 비율 계산 (`pane-widths`)

**Files:**
- Create: `src/renderer/pane-widths.ts`
- Test: `tests/renderer/pane-widths.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MIN_PANE_WIDTH_PX = 240`
  - `equalWidths(count: number): number[]`
  - `widthsAfterAdd(widths: readonly number[], afterIndex: number, minRatio: number): number[]`
  - `widthsAfterRemove(widths: readonly number[], index: number): number[]`
  - `widthsAfterDrag(widths: readonly number[], dividerIndex: number, pointerRatio: number, minRatio: number): number[]`
  - `canAddPane(count: number, availablePx: number, minPanePx: number): boolean`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/renderer/pane-widths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MIN_PANE_WIDTH_PX,
  canAddPane,
  equalWidths,
  widthsAfterAdd,
  widthsAfterDrag,
  widthsAfterRemove,
} from '../../src/renderer/pane-widths'

const rounded = (widths: number[]) => widths.map((width) => Math.round(width * 1000) / 1000)

describe('칸 너비', () => {
  it('칸 최소 너비는 240px이다', () => {
    expect(MIN_PANE_WIDTH_PX).toBe(240)
  })

  it('같은 너비로 나누면 칸마다 같은 비율을 받는다', () => {
    expect(equalWidths(2)).toEqual([0.5, 0.5])
    expect(rounded(equalWidths(3))).toEqual([0.333, 0.333, 0.333])
  })

  it('칸을 더하면 지금 칸의 너비를 반으로 나눠 새 칸에 준다', () => {
    expect(rounded(widthsAfterAdd([0.6, 0.4], 0, 0.1))).toEqual([0.3, 0.3, 0.4])
  })

  it('반으로 나눈 너비가 최소 너비보다 좁으면 모든 칸을 같은 너비로 나눈다', () => {
    expect(rounded(widthsAfterAdd([0.8, 0.2], 1, 0.15))).toEqual([0.333, 0.333, 0.333])
  })

  it('칸을 닫으면 그 너비를 왼쪽 칸에 준다', () => {
    expect(rounded(widthsAfterRemove([0.2, 0.3, 0.5], 2))).toEqual([0.2, 0.8])
  })

  it('첫 칸을 닫으면 그 너비를 오른쪽 칸에 준다', () => {
    expect(rounded(widthsAfterRemove([0.3, 0.2, 0.5], 0))).toEqual([0.5, 0.5])
  })

  it('막대를 끌면 양옆 두 칸의 너비만 바뀐다', () => {
    expect(rounded(widthsAfterDrag([0.2, 0.3, 0.5], 1, 0.6, 0.1))).toEqual([0.2, 0.4, 0.4])
  })

  it('막대를 끌어도 칸은 최소 너비보다 좁아지지 않는다', () => {
    expect(rounded(widthsAfterDrag([0.5, 0.5], 0, 0.01, 0.2))).toEqual([0.2, 0.8])
    expect(rounded(widthsAfterDrag([0.5, 0.5], 0, 0.99, 0.2))).toEqual([0.8, 0.2])
  })

  it('두 칸을 합쳐도 최소 너비 두 개가 안 되면 막대를 끌어도 그대로 둔다', () => {
    expect(widthsAfterDrag([0.1, 0.1, 0.8], 0, 0.15, 0.2)).toEqual([0.1, 0.1, 0.8])
  })

  it('창 너비가 모든 칸의 최소 너비를 담을 수 있을 때만 칸을 더할 수 있다', () => {
    expect(canAddPane(1, 480, 240)).toBe(true)
    expect(canAddPane(1, 479, 240)).toBe(false)
    expect(canAddPane(2, 720, 240)).toBe(true)
    expect(canAddPane(1, 0, 240)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/renderer/pane-widths.test.ts`
Expected: FAIL (`Failed to resolve import "../../src/renderer/pane-widths"`)

- [ ] **Step 3: 구현**

`src/renderer/pane-widths.ts`:

```ts
export const MIN_PANE_WIDTH_PX = 240

export function equalWidths(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count)
}

// 칸이 3개 이상이면 이미 좁은 칸을 반으로 나눌 수 있어, 그때는 최소 너비를 지키도록 모두 같은 너비로 나눈다.
export function widthsAfterAdd(widths: readonly number[], afterIndex: number, minRatio: number): number[] {
  const half = widths[afterIndex] / 2
  if (half < minRatio) return equalWidths(widths.length + 1)
  const next = [...widths]
  next.splice(afterIndex, 1, half, half)
  return next
}

export function widthsAfterRemove(widths: readonly number[], index: number): number[] {
  if (widths.length <= 1) return [1]
  const receiver = index === 0 ? 1 : index - 1
  const next = [...widths]
  next[receiver] += next[index]
  next.splice(index, 1)
  return next
}

export function widthsAfterDrag(
  widths: readonly number[],
  dividerIndex: number,
  pointerRatio: number,
  minRatio: number,
): number[] {
  const left = dividerIndex
  const right = dividerIndex + 1
  const pairTotal = widths[left] + widths[right]
  if (pairTotal < minRatio * 2) return [...widths]
  const pairStart = widths.slice(0, left).reduce((sum, width) => sum + width, 0)
  const leftWidth = Math.min(pairTotal - minRatio, Math.max(minRatio, pointerRatio - pairStart))
  const next = [...widths]
  next[left] = leftWidth
  next[right] = pairTotal - leftWidth
  return next
}

export function canAddPane(count: number, availablePx: number, minPanePx: number): boolean {
  return availablePx >= (count + 1) * minPanePx
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/renderer/pane-widths.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/pane-widths.ts tests/renderer/pane-widths.test.ts
git commit -m "feat: 칸 너비 비율 계산" -m "칸을 더하고 닫고 막대를 끌 때의 너비 비율과 칸을 더할 수 있는지를 순수 함수로 계산한다. 칸 수에 묶이지 않는다."
```

---

### Task 3: 최대 칸 수, 경로 비교, 칸 목록 (`shared/panes`, `pane-set`)

**Files:**
- Create: `src/shared/panes.ts`, `src/renderer/pane-set.ts`
- Test: `tests/shared/panes.test.ts`, `tests/renderer/pane-set.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `src/shared/panes.ts`: `MAX_PANES = 2`, `isSamePath(a: string, b: string): boolean`
  - `src/renderer/pane-set.ts`:
    ```ts
    export type PaneChange = { kind: 'added'; index: number } | { kind: 'removed'; index: number } | { kind: 'focused' }
    export type PaneSet<P> = { all(): readonly P[]; focused(): P; add(): P | null; remove(pane: P): boolean; focus(pane: P): void; focusNext(): void }
    export type PaneSetOptions<P> = { maxPanes: number; createPane(): P; destroyPane(pane: P): void; onChanged(change: PaneChange): void }
    export function createPaneSet<P>(options: PaneSetOptions<P>): PaneSet<P>
    ```
  - `createPaneSet`은 만들 때 `createPane()`을 한 번 불러 첫 칸을 만든다. 이때는 `onChanged`를 부르지 않는다.
  - `added`의 `index`는 새 칸의 위치, `removed`의 `index`는 지운 칸이 있던 위치다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/shared/panes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_PANES, isSamePath } from '../../src/shared/panes'

describe('칸 공용 규칙', () => {
  it('최대 칸 수는 2칸이다', () => {
    expect(MAX_PANES).toBe(2)
  })

  it('대소문자만 다른 경로는 같은 파일로 본다', () => {
    expect(isSamePath('C:\\Notes\\A.md', 'c:\\notes\\a.md')).toBe(true)
    expect(isSamePath('/Users/me/Todo.md', '/users/me/todo.md')).toBe(true)
  })

  it('다른 경로는 다른 파일로 본다', () => {
    expect(isSamePath('C:\\notes\\a.md', 'C:\\notes\\b.md')).toBe(false)
  })
})
```

`tests/renderer/pane-set.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createPaneSet, type PaneChange } from '../../src/renderer/pane-set'

function setup(maxPanes = 2) {
  let nextId = 1
  const destroyed: number[] = []
  const changes: PaneChange[] = []
  const panes = createPaneSet<{ id: number }>({
    maxPanes,
    createPane: () => ({ id: nextId++ }),
    destroyPane: (pane) => destroyed.push(pane.id),
    onChanged: (change) => changes.push(change),
  })
  const ids = () => panes.all().map((pane) => pane.id)
  const paneById = (id: number) => panes.all().find((pane) => pane.id === id)!
  return { panes, destroyed, changes, ids, paneById }
}

describe('칸 목록', () => {
  it('처음에는 칸 하나가 지금 칸이다', () => {
    const { panes, ids, changes } = setup()
    expect(ids()).toEqual([1])
    expect(panes.focused().id).toBe(1)
    expect(changes).toEqual([])
  })

  it('칸을 더하면 지금 칸 오른쪽에 생기고 새 칸이 지금 칸이 된다', () => {
    const { panes, ids, changes, paneById } = setup(3)
    panes.add()
    panes.focus(paneById(1))
    const added = panes.add()
    expect(ids()).toEqual([1, 3, 2])
    expect(panes.focused()).toBe(added)
    expect(changes.at(-1)).toEqual({ kind: 'added', index: 1 })
  })

  it('최대 칸 수면 칸을 더하지 않는다', () => {
    const { panes, ids } = setup(2)
    panes.add()
    expect(panes.add()).toBeNull()
    expect(ids()).toEqual([1, 2])
  })

  it('최대 칸 수가 3이면 세 칸까지 더한다', () => {
    const { panes, ids } = setup(3)
    panes.add()
    panes.add()
    expect(panes.add()).toBeNull()
    expect(ids()).toEqual([1, 2, 3])
  })

  it('마지막 한 칸은 닫지 않는다', () => {
    const { panes, destroyed } = setup()
    expect(panes.remove(panes.focused())).toBe(false)
    expect(destroyed).toEqual([])
  })

  it('지금 칸을 닫으면 없애고 왼쪽 칸이 지금 칸이 된다', () => {
    const { panes, ids, destroyed, changes, paneById } = setup(3)
    panes.add()
    panes.add()
    expect(panes.remove(paneById(3))).toBe(true)
    expect(ids()).toEqual([1, 2])
    expect(destroyed).toEqual([3])
    expect(panes.focused().id).toBe(2)
    expect(changes.at(-1)).toEqual({ kind: 'removed', index: 2 })
  })

  it('첫 칸을 닫으면 오른쪽 칸이 지금 칸이 된다', () => {
    const { panes, paneById } = setup()
    panes.add()
    panes.focus(paneById(1))
    panes.remove(paneById(1))
    expect(panes.focused().id).toBe(2)
  })

  it('지금 칸이 아닌 칸을 닫으면 지금 칸은 그대로다', () => {
    const { panes, paneById } = setup(3)
    panes.add()
    panes.add()
    panes.remove(paneById(1))
    expect(panes.focused().id).toBe(3)
  })

  it('다음 칸으로 옮기면 마지막 칸 다음은 첫 칸이다', () => {
    const { panes } = setup(3)
    panes.add()
    panes.add()
    panes.focusNext()
    expect(panes.focused().id).toBe(1)
    panes.focusNext()
    expect(panes.focused().id).toBe(2)
  })

  it('지금 칸이 바뀌면 바뀌었다고 알리고, 이미 지금 칸인 칸을 고르면 알리지 않는다', () => {
    const { panes, changes, paneById } = setup()
    panes.add()
    const before = changes.length
    panes.focus(paneById(2))
    expect(changes).toHaveLength(before)
    panes.focus(paneById(1))
    expect(changes.at(-1)).toEqual({ kind: 'focused' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/shared/panes.test.ts tests/renderer/pane-set.test.ts`
Expected: FAIL (모듈을 찾지 못함)

- [ ] **Step 3: 구현**

`src/shared/panes.ts`:

```ts
export const MAX_PANES = 2

// Windows와 macOS의 기본 파일 시스템은 대소문자를 구분하지 않는다.
export function isSamePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}
```

`src/renderer/pane-set.ts`:

```ts
export type PaneChange = { kind: 'added'; index: number } | { kind: 'removed'; index: number } | { kind: 'focused' }

export type PaneSet<P> = {
  all(): readonly P[]
  focused(): P
  add(): P | null
  remove(pane: P): boolean
  focus(pane: P): void
  focusNext(): void
}

export type PaneSetOptions<P> = {
  maxPanes: number
  createPane(): P
  destroyPane(pane: P): void
  onChanged(change: PaneChange): void
}

export function createPaneSet<P>({ maxPanes, createPane, destroyPane, onChanged }: PaneSetOptions<P>): PaneSet<P> {
  const panes: P[] = [createPane()]
  let focusedIndex = 0

  return {
    all: () => panes,
    focused: () => panes[focusedIndex],
    add() {
      if (panes.length >= maxPanes) return null
      const pane = createPane()
      const index = focusedIndex + 1
      panes.splice(index, 0, pane)
      focusedIndex = index
      onChanged({ kind: 'added', index })
      return pane
    },
    remove(pane) {
      const index = panes.indexOf(pane)
      if (index === -1 || panes.length === 1) return false
      const focusedPane = panes[focusedIndex]
      panes.splice(index, 1)
      destroyPane(pane)
      focusedIndex = focusedPane === pane ? Math.max(0, index - 1) : panes.indexOf(focusedPane)
      onChanged({ kind: 'removed', index })
      return true
    },
    focus(pane) {
      const index = panes.indexOf(pane)
      if (index === -1 || index === focusedIndex) return
      focusedIndex = index
      onChanged({ kind: 'focused' })
    },
    focusNext() {
      if (panes.length === 1) return
      focusedIndex = (focusedIndex + 1) % panes.length
      onChanged({ kind: 'focused' })
    },
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/shared/panes.test.ts tests/renderer/pane-set.test.ts`
Expected: PASS (3 + 10 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/shared/panes.ts src/renderer/pane-set.ts tests/shared/panes.test.ts tests/renderer/pane-set.test.ts
git commit -m "feat: 칸 목록과 최대 칸 수" -m "칸 목록과 지금 칸을 관리하는 pane-set을 칸 종류에 묶이지 않게 만든다. 최대 칸 수와 대소문자를 구분하지 않는 경로 비교는 설정에서도 쓰므로 shared에 둔다."
```

---

### Task 4: 열린 파일 목록과 칸 너비 설정 (`openFiles`, `paneWidths`)

**Files:**
- Modify: `src/shared/types.ts` (`Settings`)
- Modify: `src/shared/settings.ts`
- Modify: `src/renderer/app.ts` (임시 연결)
- Test: `tests/shared/settings.test.ts`, `tests/main/settings-store.test.ts`

**Interfaces:**
- Consumes: `MAX_PANES`, `isSamePath` (Task 3)
- Produces: `Settings.openFiles: string[]`, `Settings.paneWidths: number[]` (`lastFile`은 없어진다)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/shared/settings.test.ts`:

1. import에 `MAX_PANES`를 더한다:

```ts
import { MAX_PANES } from '../../src/shared/panes'
```

2. `'올바른 값은 그대로 유지한다'` 테스트의 `lastFile: 'C:\\notes\\회의록.md',` 줄을 아래 두 줄로 바꾼다:

```ts
      openFiles: ['C:\\notes\\회의록.md'],
      paneWidths: [0.4, 0.6],
```

3. 파일 끝에 더한다:

```ts
describe('열린 파일 목록 설정', () => {
  it('처음에는 열린 파일이 없다', () => {
    expect(defaultSettings('win32').openFiles).toEqual([])
  })

  it('예전 설정의 마지막 파일은 열린 파일 목록으로 옮긴다', () => {
    const result = normalizeSettings({ lastFile: 'C:\\notes\\a.md' }, 'win32')
    expect(result.openFiles).toEqual(['C:\\notes\\a.md'])
    expect(result).not.toHaveProperty('lastFile')
  })

  it('열린 파일 목록이 있으면 예전 마지막 파일은 쓰지 않는다', () => {
    const result = normalizeSettings({ openFiles: ['C:\\notes\\b.md'], lastFile: 'C:\\notes\\a.md' }, 'win32')
    expect(result.openFiles).toEqual(['C:\\notes\\b.md'])
  })

  it('중복 경로와 문자열이 아닌 값은 버리고 최대 칸 수까지만 둔다', () => {
    const result = normalizeSettings(
      { openFiles: ['C:\\notes\\a.md', 'c:\\NOTES\\A.md', 3, '', 'C:\\notes\\b.md', 'C:\\notes\\c.md'] },
      'win32',
    )
    expect(result.openFiles).toEqual(['C:\\notes\\a.md', 'C:\\notes\\b.md', 'C:\\notes\\c.md'].slice(0, MAX_PANES))
  })
})

describe('칸 너비 설정', () => {
  it('처음에는 칸 너비가 정해져 있지 않다', () => {
    expect(defaultSettings('win32').paneWidths).toEqual([])
  })

  it('합이 1인 비율 목록은 그대로 둔다', () => {
    expect(normalizeSettings({ paneWidths: [0.3, 0.7] }, 'win32').paneWidths).toEqual([0.3, 0.7])
  })

  it('합이 1이 아니거나 양수가 아닌 값이 있으면 빈 목록으로 바꾼다', () => {
    expect(normalizeSettings({ paneWidths: [0.5, 0.6] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: [0.5, '0.5'] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: [0, 1] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: 'wide' }, 'win32').paneWidths).toEqual([])
  })
})
```

`tests/main/settings-store.test.ts`의 `'저장이 끝나기 전에 읽어도 방금 저장한 설정을 돌려준다'` 테스트에서
`const changed = { ...defaultSettings('win32'), lastFile: '/notes/a.md' }` → `const changed = { ...defaultSettings('win32'), openFiles: ['/notes/a.md'] }`

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/shared/settings.test.ts tests/main/settings-store.test.ts`
Expected: FAIL (`openFiles`가 `undefined`)

- [ ] **Step 3: 구현**

`src/shared/types.ts`의 `Settings`에서 `lastFile: string | null` 줄을 아래 두 줄로 바꾼다:

```ts
  openFiles: string[]
  paneWidths: number[]
```

`src/shared/settings.ts`:

1. 첫 줄 아래에 import를 더한다:

```ts
import { MAX_PANES, isSamePath } from './panes'
```

2. `defaultSettings`의 `lastFile: null,` → 아래 두 줄:

```ts
    openFiles: [],
    paneWidths: [],
```

3. `normalizeSettings`의 `lastFile: pickNonEmptyString(raw.lastFile),` → 아래 두 줄:

```ts
    openFiles: pickOpenFiles(raw.openFiles, raw.lastFile),
    paneWidths: pickPaneWidths(raw.paneWidths),
```

4. `pickWindowBounds` 함수 아래에 더한다:

```ts
// 나란히 쓰기 이전 버전은 마지막 파일 하나만 lastFile에 저장했다.
function pickOpenFiles(value: unknown, legacyLastFile: unknown): string[] {
  if (!Array.isArray(value)) {
    const lastFile = pickNonEmptyString(legacyLastFile)
    return lastFile ? [lastFile] : []
  }
  const files: string[] = []
  for (const item of value) {
    const path = pickNonEmptyString(item)
    if (path && !files.some((file) => isSamePath(file, path))) files.push(path)
  }
  return files.slice(0, MAX_PANES)
}

const WIDTH_SUM_TOLERANCE = 0.001

function pickPaneWidths(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return []
  const widths = value.filter((width): width is number => typeof width === 'number' && Number.isFinite(width) && width > 0)
  if (widths.length !== value.length) return []
  const sum = widths.reduce((total, width) => total + width, 0)
  return Math.abs(sum - 1) <= WIDTH_SUM_TOLERANCE ? widths : []
}
```

5. 임시 연결: `src/renderer/app.ts`

`onFileLocationChanged` 블록을 아래로 바꾼다:

```ts
    onFileLocationChanged: (location) => {
      if (!location) updateSettings({ openFiles: [] })
      else if (location.origin === 'saved')
        updateSettings({ openFiles: [location.path], lastDirectory: location.directory, defaultFormat: location.format })
      else updateSettings({ openFiles: [location.path], lastDirectory: location.directory })
      documentStatus.runNow()
    },
```

시작 부분의 마지막 파일 다시 열기를 바꾼다:

```ts
  const [lastOpenFile] = settings.openFiles
  if (requestedFile) await commands.openRequestedFile(requestedFile)
  else if (!restored && lastOpenFile && !(await commands.openPath(lastOpenFile))) {
    updateSettings({ openFiles: [] })
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/shared/types.ts src/shared/settings.ts src/renderer/app.ts tests/shared/settings.test.ts tests/main/settings-store.test.ts
git commit -m "feat: 열린 파일 목록과 칸 너비 설정" -m "마지막 파일 하나(lastFile) 대신 칸 순서대로 열린 파일 목록(openFiles)과 칸 너비 비율(paneWidths)을 저장한다. 예전 설정의 lastFile은 읽을 때 openFiles로 옮긴다."
```

---

### Task 5: 백업을 칸 목록 형식으로 (`BackupSet`)

**Files:**
- Modify: `src/shared/types.ts` (`Backup` → `PaneBackup`, `BackupSet`)
- Modify: `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, `src/main/dialogs.ts`
- Modify: `src/main/backup-store.ts`, `src/main/dialog-options.ts`
- Modify: `src/renderer/document-state.ts`, `src/renderer/autosave.ts`, `src/renderer/document-commands.ts`
- Modify: `src/renderer/app.ts` (임시 연결)
- Test: `tests/main/backup-store.test.ts`, `tests/main/dialog-options.test.ts`, `tests/renderer/document-state.test.ts`, `tests/renderer/autosave.test.ts`, `tests/renderer/document-commands.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  // shared/types.ts
  export type PaneBackup = { path: string | null; eol: Eol; unsavedContent: string | null }
  export type BackupSet = { savedAt: string; panes: PaneBackup[] }
  // shared/api.ts (ImworkingApi)
  askRestoreBackup(savedAt: string, unsavedCount: number): Promise<boolean>
  readBackup(): Promise<BackupSet | null>
  writeBackup(backup: BackupSet): Promise<void>
  // main/dialog-options.ts
  export function restoreBackupDialog(savedAt: string, unsavedCount: number)
  // renderer/document-state.ts (DocumentState)
  loadUnsaved(backup: PaneBackup): void
  snapshot(currentText: string): PaneBackup   // toBackup은 없어진다
  // renderer/autosave.ts
  export type Autosave = { start(): void; stop(): void; flushNow(): Promise<void> }   // forgetLastBackup은 없어진다
  export type AutosaveOptions = { intervalMs?: number; takeSnapshot(): BackupSet | null; writeBackup(backup: BackupSet): Promise<void>; clearBackup(): Promise<void> }
  export function unsavedPaneCount(backup: BackupSet): number
  export function backupSetOf(panes: PaneBackup[], savedAt: string): BackupSet | null
  // renderer/document-commands.ts
  restoreBackup(backup: PaneBackup): void   // Task 6에서 restore(backup): Promise<boolean>으로 바뀐다
  ```

- [ ] **Step 1: 실패하는 테스트 쓰기 (main)**

`tests/main/backup-store.test.ts` 전체를 아래로 바꾼다:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackupStore } from '../../src/main/backup-store'
import type { BackupSet } from '../../src/shared/types'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-backup-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const sampleBackup: BackupSet = {
  savedAt: '2026-10-08T05:00:00.000Z',
  panes: [
    { path: 'C:\\notes\\회의록.md', eol: 'crlf', unsavedContent: '# 쓰다 만 글' },
    { path: 'C:\\notes\\요약.md', eol: 'crlf', unsavedContent: null },
  ],
}

async function writeRawBackup(content: string): Promise<string> {
  const backupDirectory = join(directory, 'backup')
  await mkdir(backupDirectory)
  await writeFile(join(backupDirectory, 'current.json'), content)
  return backupDirectory
}

describe('자동 백업 저장소', () => {
  it('백업이 없으면 아무것도 돌려주지 않는다', async () => {
    expect(await createBackupStore(join(directory, 'backup')).read()).toBeNull()
  })

  it('쓴 백업을 칸 순서 그대로 다시 읽는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    expect(await store.read()).toEqual(sampleBackup)
  })

  it('새 문서 칸의 백업은 경로 없이 저장된다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write({ ...sampleBackup, panes: [{ path: null, eol: 'lf', unsavedContent: '새 글' }] })
    expect((await store.read())?.panes[0].path).toBeNull()
  })

  it('예전 형식의 백업은 칸 하나짜리 백업으로 읽는다', async () => {
    const backupDirectory = await writeRawBackup(
      JSON.stringify({ path: 'C:\\notes\\a.md', content: '# 예전 글', eol: 'lf', savedAt: '2026-10-08T05:00:00.000Z' }),
    )
    expect(await createBackupStore(backupDirectory).read()).toEqual({
      savedAt: '2026-10-08T05:00:00.000Z',
      panes: [{ path: 'C:\\notes\\a.md', eol: 'lf', unsavedContent: '# 예전 글' }],
    })
  })

  it('지우면 다음에 읽을 때 없다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    await store.clear()
    expect(await store.read()).toBeNull()
  })

  it('지울 백업이 없어도 오류를 내지 않는다', async () => {
    await expect(createBackupStore(join(directory, 'backup')).clear()).resolves.toBeUndefined()
  })

  it('깨진 백업 파일은 없는 것으로 본다', async () => {
    const backupDirectory = await writeRawBackup('{"content": 1}')
    expect(await createBackupStore(backupDirectory).read()).toBeNull()
  })

  it('칸 목록이 비었거나 칸 정보가 틀린 백업은 없는 것으로 본다', async () => {
    const empty = await writeRawBackup(JSON.stringify({ savedAt: '2026-10-08T05:00:00.000Z', panes: [] }))
    expect(await createBackupStore(empty).read()).toBeNull()
    await writeFile(
      join(empty, 'current.json'),
      JSON.stringify({ savedAt: '2026-10-08T05:00:00.000Z', panes: [{ path: 1, eol: 'lf', unsavedContent: null }] }),
    )
    expect(await createBackupStore(empty).read()).toBeNull()
  })

  it('쓰는 중에 지우라고 하면 쓰기가 끝난 뒤에 지워서 백업이 남지 않는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    const writing = store.write(sampleBackup)
    await store.clear()
    await writing
    expect(await store.read()).toBeNull()
  })
})
```

`tests/main/dialog-options.test.ts` 전체를 아래로 바꾼다:

```ts
import { describe, expect, it } from 'vitest'
import { restoreBackupDialog } from '../../src/main/dialog-options'

describe('백업 복구 질문', () => {
  it('저장되지 않은 글 개수를 알려 준다', () => {
    expect(restoreBackupDialog('2026-10-08T05:00:00.000Z', 2).options.message).toBe('저장되지 않은 글이 2개 있습니다.')
  })

  it('질문 창을 닫거나 Esc를 누르면 복구를 고른 것으로 본다', () => {
    const { options, choseRestore } = restoreBackupDialog('2026-10-08T05:00:00.000Z', 1)
    expect(choseRestore(options.cancelId)).toBe(true)
  })

  it('버리기를 직접 눌렀을 때만 복구하지 않는다', () => {
    const { options, choseRestore } = restoreBackupDialog('2026-10-08T05:00:00.000Z', 1)
    const discardIndex = options.buttons.indexOf('버리기')
    expect(choseRestore(discardIndex)).toBe(false)
    expect(choseRestore(options.buttons.indexOf('복구'))).toBe(true)
  })
})
```

- [ ] **Step 2: 실패하는 테스트 쓰기 (renderer)**

`tests/renderer/document-state.test.ts`:

1. `'백업에서 복구한 문서는 저장하기 전까지 변경이 있다'` 테스트의 `state.loadUnsaved(...)` 줄을 바꾼다:

```ts
    state.loadUnsaved({ path: null, eol: 'lf', unsavedContent: '복구한 글' })
```

2. `describe('백업 스냅샷', ...)` 블록 전체를 아래로 바꾼다:

```ts
describe('백업 스냅샷', () => {
  it('변경이 없으면 경로와 줄바꿈만 남기고 저장 안 한 내용은 없다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.snapshot('# 회의록')).toEqual({ path: 'C:\\notes\\회의록.md', eol: 'crlf', unsavedContent: null })
  })

  it('새 문서에 아무것도 안 썼으면 저장 안 한 내용이 없다', () => {
    expect(createDocumentState('lf').snapshot('')).toEqual({ path: null, eol: 'lf', unsavedContent: null })
  })

  it('변경이 있으면 경로, 줄바꿈, 지금 내용을 남긴다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.snapshot('# 고친 글')).toEqual({
      path: 'C:\\notes\\회의록.md',
      eol: 'crlf',
      unsavedContent: '# 고친 글',
    })
  })
})
```

`tests/renderer/autosave.test.ts` 전체를 아래로 바꾼다:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_INTERVAL_MS, backupSetOf, createAutosave, unsavedPaneCount } from '../../src/renderer/autosave'
import type { BackupSet, PaneBackup } from '../../src/shared/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const SAVED_AT = '2026-10-08T00:00:00.000Z'
const paneOf = (unsavedContent: string | null): PaneBackup => ({ path: null, eol: 'lf', unsavedContent })
const backupOf = (...contents: (string | null)[]): BackupSet => ({ savedAt: SAVED_AT, panes: contents.map(paneOf) })

function setup(initialSnapshot: BackupSet | null) {
  let snapshot = initialSnapshot
  const calls: string[] = []
  let failNextWrite = false
  const autosave = createAutosave({
    takeSnapshot: () => snapshot,
    writeBackup: async (backup) => {
      if (failNextWrite) {
        failNextWrite = false
        throw new Error('disk')
      }
      calls.push(`write ${backup.panes.map((pane) => pane.unsavedContent ?? '-').join('|')}`)
    },
    clearBackup: async () => {
      calls.push('clear')
    },
  })
  return {
    autosave,
    calls,
    setSnapshot: (next: BackupSet | null) => (snapshot = next),
    failNextWrite: () => (failNextWrite = true),
  }
}

describe('자동 백업', () => {
  it('30초마다 저장 안 한 칸이 있으면 모든 칸을 백업한다', async () => {
    const { autosave, calls } = setup(backupOf('쓰는 중', null))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['write 쓰는 중|-'])
  })

  it('저장 안 한 칸이 없으면 백업을 한 번 지우고 그 뒤로는 지우지 않는다', async () => {
    const { autosave, calls } = setup(null)
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(calls).toEqual(['clear'])
  })

  it('지난 백업과 내용이 같으면 다시 백업하지 않는다', async () => {
    const { autosave, calls } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(calls).toEqual(['write 같은 글'])
  })

  it('내용이 바뀌면 다음 주기에 다시 백업한다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('첫 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(backupOf('고친 글'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(calls).toEqual(['write 첫 글', 'write 고친 글'])
  })

  it('모든 칸을 저장해 백업할 내용이 없어지면 백업을 지운다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(null)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(calls).toEqual(['write 글', 'clear'])
  })

  it('바로 백업하라고 하면 주기를 기다리지 않고 백업한다', async () => {
    const { autosave, calls } = setup(backupOf('글'))
    autosave.start()
    await autosave.flushNow()
    expect(calls).toEqual(['write 글'])
  })

  it('멈춘 뒤에도 바로 백업하라고 하면 백업한다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('첫 칸 글', '둘째 칸 글'))
    autosave.start()
    await autosave.flushNow()
    autosave.stop()
    setSnapshot(backupOf(null, '둘째 칸 글'))
    await autosave.flushNow()
    expect(calls).toEqual(['write 첫 칸 글|둘째 칸 글', 'write -|둘째 칸 글'])
  })

  it('백업에 실패하면 다음 주기에 다시 시도한다', async () => {
    const { autosave, calls, failNextWrite } = setup(backupOf('글'))
    failNextWrite()
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(calls).toEqual(['write 글'])
  })

  it('멈추면 더 이상 주기적으로 백업하지 않는다', async () => {
    const { autosave, calls } = setup(backupOf('글'))
    autosave.start()
    autosave.stop()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(calls).toEqual([])
  })
})

describe('백업할 칸 모음', () => {
  it('저장 안 한 칸이 하나도 없으면 백업할 내용이 없다', () => {
    expect(backupSetOf([paneOf(null), paneOf(null)], SAVED_AT)).toBeNull()
  })

  it('저장 안 한 칸이 있으면 모든 칸을 칸 순서대로 담는다', () => {
    expect(backupSetOf([paneOf(null), paneOf('글')], SAVED_AT)).toEqual(backupOf(null, '글'))
  })

  it('저장 안 한 칸 수를 센다', () => {
    expect(unsavedPaneCount(backupOf('가', null, '나'))).toBe(2)
  })
})
```

`tests/renderer/document-commands.test.ts`의 `'백업에서 복구하면 내용을 넣고 변경 있음 상태가 된다'` 테스트의 `commands.restoreBackup(...)` 줄을 바꾼다:

```ts
    commands.restoreBackup({ path: null, eol: 'lf', unsavedContent: '복구한 글' })
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/main/backup-store.test.ts tests/main/dialog-options.test.ts tests/renderer/document-state.test.ts tests/renderer/autosave.test.ts tests/renderer/document-commands.test.ts`
Expected: FAIL (`snapshot is not a function`, `backupSetOf` 없음, 예전 형식 백업을 읽지 못함, 질문 문구가 다름)

- [ ] **Step 4: 공용 타입과 API 바꾸기**

`src/shared/types.ts`의 `Backup` 타입을 지우고 아래로 바꾼다:

```ts
// unsavedContent가 null이면 저장 안 한 변경이 없는 칸이다. 복구할 때 칸 배치를 되살리려고 경로만 남긴다.
export type PaneBackup = {
  path: string | null
  eol: Eol
  unsavedContent: string | null
}

export type BackupSet = {
  savedAt: string
  panes: PaneBackup[]
}
```

`src/shared/api.ts`:
- 첫 줄 import의 `Backup` → `BackupSet`
- `askRestoreBackup(savedAt: string): Promise<boolean>` → `askRestoreBackup(savedAt: string, unsavedCount: number): Promise<boolean>`
- `readBackup(): Promise<Backup | null>` → `readBackup(): Promise<BackupSet | null>`
- `writeBackup(backup: Backup): Promise<void>` → `writeBackup(backup: BackupSet): Promise<void>`

`src/preload/index.ts`:

```ts
  askRestoreBackup: (savedAt, unsavedCount) => ipcRenderer.invoke(IpcChannel.askRestoreBackup, savedAt, unsavedCount),
```

`src/main/ipc.ts`:
- import의 `Backup` → `BackupSet`
- 핸들러 두 줄:

```ts
  ipcMain.handle(IpcChannel.askRestoreBackup, (_event, savedAt: string, unsavedCount: number) =>
    dialogs.askRestoreBackup(savedAt, unsavedCount),
  )
```

```ts
  ipcMain.handle(IpcChannel.writeBackup, (_event, backup: BackupSet) => backupStore.write(backup))
```

`src/main/dialogs.ts`:
- `AppDialogs`의 `askRestoreBackup(savedAt: string): Promise<boolean>` → `askRestoreBackup(savedAt: string, unsavedCount: number): Promise<boolean>`
- 구현:

```ts
    async askRestoreBackup(savedAt, unsavedCount) {
      const { options, choseRestore } = restoreBackupDialog(savedAt, unsavedCount)
      const { response } = await dialog.showMessageBox(window, options)
      return choseRestore(response)
    },
```

`src/main/dialog-options.ts`:

```ts
export function restoreBackupDialog(savedAt: string, unsavedCount: number) {
```

그리고 `message: '저장되지 않은 글이 있습니다.',` → `message: \`저장되지 않은 글이 ${unsavedCount}개 있습니다.\`,`

- [ ] **Step 5: 백업 저장소 구현**

`src/main/backup-store.ts` 전체:

```ts
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { BackupSet, Eol, PaneBackup } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { createSerialQueue } from './serial-queue'

export type BackupStore = {
  write(backup: BackupSet): Promise<void>
  read(): Promise<BackupSet | null>
  clear(): Promise<void>
}

export function createBackupStore(directory: string): BackupStore {
  const filePath = join(directory, 'current.json')
  // 저장 직전에 시작된 자동 백업이 저장 뒤의 지우기보다 늦게 끝나면 저장한 글이 백업으로 남으므로 순서대로 처리한다.
  const queue = createSerialQueue()
  return {
    write: (backup) =>
      queue.run(async () => {
        await mkdir(directory, { recursive: true })
        await writeFileAtomic(filePath, JSON.stringify(backup))
      }),
    read: () =>
      queue.run(async () => {
        try {
          return backupSetFrom(JSON.parse(await readFile(filePath, 'utf8')))
        } catch {
          return null
        }
      }),
    clear: () => queue.run(() => rm(filePath, { force: true })),
  }
}

type LegacyBackup = { path: string | null; content: string; eol: Eol; savedAt: string }

function backupSetFrom(value: unknown): BackupSet | null {
  if (isBackupSet(value)) return value
  // 나란히 쓰기 이전 버전은 문서 하나만 { path, content, eol, savedAt } 형식으로 백업했다.
  if (isLegacyBackup(value)) {
    return { savedAt: value.savedAt, panes: [{ path: value.path, eol: value.eol, unsavedContent: value.content }] }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isEol = (value: unknown): value is Eol => value === 'lf' || value === 'crlf'
const isPathOrNull = (value: unknown) => value === null || typeof value === 'string'

function isPaneBackup(value: unknown): value is PaneBackup {
  return (
    isRecord(value) &&
    isPathOrNull(value.path) &&
    isEol(value.eol) &&
    (value.unsavedContent === null || typeof value.unsavedContent === 'string')
  )
}

function isBackupSet(value: unknown): value is BackupSet {
  return (
    isRecord(value) &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.panes) &&
    value.panes.length > 0 &&
    value.panes.every(isPaneBackup)
  )
}

function isLegacyBackup(value: unknown): value is LegacyBackup {
  return (
    isRecord(value) &&
    isPathOrNull(value.path) &&
    typeof value.content === 'string' &&
    isEol(value.eol) &&
    typeof value.savedAt === 'string'
  )
}
```

- [ ] **Step 6: 문서 상태와 자동 백업 구현**

`src/renderer/document-state.ts`:
- import의 `Backup` → `PaneBackup`
- 타입의 `loadUnsaved(backup: Backup): void` → `loadUnsaved(backup: PaneBackup): void`
- 타입의 `toBackup(currentText: string, savedAt: string): Backup | null` → `snapshot(currentText: string): PaneBackup`
- 구현의 `toBackup(...) { ... }` 메서드를 아래로 바꾼다:

```ts
    snapshot(currentText) {
      return { path: info.path, eol: info.eol, unsavedContent: isDirty(currentText) ? currentText : null }
    },
```

`src/renderer/autosave.ts` 전체:

```ts
import type { BackupSet, PaneBackup } from '../shared/types'

export const AUTOSAVE_INTERVAL_MS = 30_000

export type Autosave = {
  start(): void
  stop(): void
  flushNow(): Promise<void>
}

export type AutosaveOptions = {
  intervalMs?: number
  takeSnapshot(): BackupSet | null
  writeBackup(backup: BackupSet): Promise<void>
  clearBackup(): Promise<void>
}

export function unsavedPaneCount(backup: BackupSet): number {
  return backup.panes.filter((pane) => pane.unsavedContent !== null).length
}

export function backupSetOf(panes: PaneBackup[], savedAt: string): BackupSet | null {
  const backup = { savedAt, panes }
  return unsavedPaneCount(backup) > 0 ? backup : null
}

const CLEARED = 'cleared'
type DiskBackup = PaneBackup[] | typeof CLEARED

export function createAutosave({
  intervalMs = AUTOSAVE_INTERVAL_MS,
  takeSnapshot,
  writeBackup,
  clearBackup,
}: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setInterval> | null = null
  // 디스크에 있는 백업과 같으면 다시 쓰지 않는다. null이면 디스크 상태를 모른다.
  let lastWritten: DiskBackup | null = null

  async function backupIfChanged(): Promise<void> {
    const snapshot = takeSnapshot()
    const next: DiskBackup = snapshot ? snapshot.panes : CLEARED
    if (lastWritten !== null && isSameBackup(lastWritten, next)) return
    lastWritten = next
    try {
      if (snapshot) await writeBackup(snapshot)
      else await clearBackup()
    } catch {
      lastWritten = null
    }
  }

  return {
    start() {
      if (!timer) timer = setInterval(() => void backupIfChanged(), intervalMs)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    flushNow: backupIfChanged,
  }
}

function isSameBackup(a: DiskBackup, b: DiskBackup): boolean {
  if (a === CLEARED || b === CLEARED) return a === b
  return (
    a.length === b.length &&
    a.every(
      (pane, index) =>
        pane.path === b[index].path && pane.eol === b[index].eol && pane.unsavedContent === b[index].unsavedContent,
    )
  )
}
```

`src/renderer/document-commands.ts`:
- import의 `Backup` → `PaneBackup`
- 타입의 `restoreBackup(backup: Backup): void` → `restoreBackup(backup: PaneBackup): void`
- 구현:

```ts
    restoreBackup(backup) {
      documentState.loadUnsaved(backup)
      editor.setText(backup.unsavedContent ?? '')
      deps.onDocumentReplaced()
    },
```

- [ ] **Step 7: 임시 연결 (`src/renderer/app.ts`)**

1. import `import { createAutosave } from './autosave'` → `import { backupSetOf, createAutosave, unsavedPaneCount } from './autosave'`
2. `createAutosave({...})` 블록을 아래로 바꾼다:

```ts
  const autosave = createAutosave({
    takeSnapshot: () => backupSetOf([documentState.snapshot(editor.getText())], new Date().toISOString()),
    writeBackup: (backup) => api.writeBackup(backup),
    clearBackup: () => api.clearBackup(),
  })
```

3. `commandsApi`의 `clearBackup` 항목을 아래로 바꾼다 (`forgetLastBackup`이 없어졌다):

```ts
    clearBackup: () => api.clearBackup(),
```

4. 시작할 때 복구하는 세 줄(`const backup = ...`부터 `else if (backup) await api.clearBackup()`까지)을 아래로 바꾼다:

```ts
  const backup = await api.readBackup()
  const unsavedCount = backup ? unsavedPaneCount(backup) : 0
  const restored = backup !== null && unsavedCount > 0 && (await api.askRestoreBackup(backup.savedAt, unsavedCount))
  const restoredPane = backup?.panes.find((pane) => pane.unsavedContent !== null)
  if (restored && restoredPane) commands.restoreBackup(restoredPane)
  else if (backup) await api.clearBackup()
```

- [ ] **Step 8: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add src/shared/types.ts src/shared/api.ts src/preload/index.ts src/main/ipc.ts src/main/dialogs.ts src/main/backup-store.ts src/main/dialog-options.ts src/renderer/document-state.ts src/renderer/autosave.ts src/renderer/document-commands.ts src/renderer/app.ts tests/main/backup-store.test.ts tests/main/dialog-options.test.ts tests/renderer/document-state.test.ts tests/renderer/autosave.test.ts tests/renderer/document-commands.test.ts
git commit -m "feat: 백업을 칸 목록 형식으로 저장" -m "백업 파일에 모든 칸의 경로, 줄바꿈, 저장 안 한 내용을 칸 순서대로 쓴다. 저장 안 한 칸이 없으면 자동 백업이 백업을 지우고, flushNow로 주기를 기다리지 않고 고쳐 쓸 수 있다. 예전 형식 백업은 칸 하나짜리로 읽고, 복구 질문에 저장 안 한 글 개수를 보여 준다."
```

---

### Task 6: 공용 명령 잠금과 칸 하나의 문서 명령 (`command-lock`, `document-commands`, `close-handler`)

**Files:**
- Create: `src/renderer/command-lock.ts`
- Modify: `src/renderer/document-commands.ts`, `src/renderer/close-handler.ts`
- Modify: `src/renderer/app.ts` (임시 연결)
- Test: `tests/renderer/command-lock.test.ts`, `tests/renderer/document-commands.test.ts`, `tests/renderer/close-handler.test.ts`

**Interfaces:**
- Consumes: `PaneBackup` (Task 5), `Autosave.flushNow` (Task 5)
- Produces:
  ```ts
  // command-lock.ts
  export type GuardedCommand<Args extends unknown[]> = (...args: Args) => Promise<boolean>
  export type CommandLock = {
    unlessBusy<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
    afterRunning<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
  }
  export function createCommandLock(): CommandLock
  // document-commands.ts
  export type CommandsApi = Pick<ImworkingApi, 'openFileDialog' | 'openPath' | 'saveFile' | 'confirmDiscard'>
  export type DocumentCommandsDeps = {
    api: CommandsApi; lock: CommandLock; editor: TextSource; documentState: DocumentState
    savePreferences(): { defaultDirectory: string | null; defaultFormat: FileFormat }
    focusIfOpenElsewhere(path: string): boolean
    onFileLocationChanged(location: FileLocation | null): void
    onDocumentReplaced(): void
    onBackupStale(): void
  }
  export type DocumentCommands = {
    newDocument(): Promise<boolean>; open(): Promise<boolean>; save(): Promise<boolean>; saveAs(): Promise<boolean>
    confirmClose(): Promise<boolean>
    openPath(path: string): Promise<boolean>
    openRequestedFile(path: string): Promise<boolean>
    restore(backup: PaneBackup): Promise<boolean>
  }
  // close-handler.ts
  export type CloseHandlerDeps = { isStartupFinished(): boolean; closeWindow(): Promise<boolean>; closeWindowNow(): void; pauseAutosave(): void; resumeAutosave(): void }
  ```
- 문서 명령은 더 이상 백업을 지우거나 창을 닫지 않는다. 저장·열기·새 문서 뒤에는 `onBackupStale()`로 알리고, 창 닫기는 `confirmClose()`로 "이 칸을 닫아도 되는지"만 답한다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/renderer/command-lock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createCommandLock } from '../../src/renderer/command-lock'

function deferred() {
  let resolve: (value: boolean) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('명령 잠금', () => {
  it('명령이 진행 중이면 다른 명령은 실행하지 않고 거절한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    let secondRuns = 0
    const running = lock.unlessBusy(() => first.promise)()
    const second = lock.unlessBusy(async () => {
      secondRuns++
      return true
    })
    expect(await second()).toBe(false)
    expect(secondRuns).toBe(0)
    first.resolve(true)
    expect(await running).toBe(true)
  })

  it('진행 중인 명령이 끝나면 다음 명령을 받는다', async () => {
    const lock = createCommandLock()
    await lock.unlessBusy(async () => true)()
    expect(await lock.unlessBusy(async () => true)()).toBe(true)
  })

  it('기다리는 명령은 진행 중인 명령이 끝난 뒤에 실행한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    const order: string[] = []
    void lock.unlessBusy(async () => {
      const value = await first.promise
      order.push('first')
      return value
    })()
    const waiting = lock.afterRunning(async () => {
      order.push('waiting')
      return true
    })()
    await Promise.resolve()
    expect(order).toEqual([])
    first.resolve(true)
    expect(await waiting).toBe(true)
    expect(order).toEqual(['first', 'waiting'])
  })

  it('진행 중인 명령이 실패해도 기다리던 명령은 실행한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    const failing = lock.unlessBusy(() => first.promise)()
    const waiting = lock.afterRunning(async () => true)()
    first.reject(new Error('disk'))
    await expect(failing).rejects.toThrow('disk')
    expect(await waiting).toBe(true)
  })
})
```

`tests/renderer/close-handler.test.ts` 전체를 아래로 바꾼다:

```ts
import { describe, expect, it } from 'vitest'
import { createCloseHandler } from '../../src/renderer/close-handler'

function setup({ startupFinished, windowCloses }: { startupFinished: boolean; windowCloses: boolean }) {
  const calls: string[] = []
  const handleClose = createCloseHandler({
    isStartupFinished: () => startupFinished,
    closeWindow: async () => {
      calls.push('closeWindow')
      return windowCloses
    },
    closeWindowNow: () => calls.push('closeWindowNow'),
    pauseAutosave: () => calls.push('pauseAutosave'),
    resumeAutosave: () => calls.push('resumeAutosave'),
  })
  return { handleClose, calls }
}

describe('창 닫기 요청', () => {
  it('시작할 때 복구 여부를 정하기 전에 닫으면 백업을 지우지 않고 바로 닫는다', async () => {
    const { handleClose, calls } = setup({ startupFinished: false, windowCloses: true })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeWindowNow'])
  })

  it('시작이 끝난 뒤에는 모든 칸의 저장 확인을 거쳐 닫는다', async () => {
    const { handleClose, calls } = setup({ startupFinished: true, windowCloses: true })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeWindow'])
  })

  it('저장 확인에서 취소하면 자동 백업을 다시 시작한다', async () => {
    const { handleClose, calls } = setup({ startupFinished: true, windowCloses: false })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeWindow', 'resumeAutosave'])
  })
})
```

`tests/renderer/document-commands.test.ts` 전체를 아래로 바꾼다:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createCommandLock, type CommandLock } from '../../src/renderer/command-lock'
import {
  createDocumentCommands,
  type CommandsApi,
  type FileLocation,
} from '../../src/renderer/document-commands'
import { createDocumentState } from '../../src/renderer/document-state'
import type { OpenedFile } from '../../src/shared/api'

const openedFile: OpenedFile = {
  path: '/notes/a.md',
  directory: '/notes',
  text: '# 열린 글',
  eol: 'lf',
  encoding: 'utf-8',
  format: 'md',
}

const openedResult = { status: 'opened' as const, file: openedFile }

function createFakeApi(overrides: Partial<CommandsApi> = {}) {
  const calls: string[] = []
  const api: CommandsApi = {
    openFileDialog: async () => {
      calls.push('openFileDialog')
      return openedResult
    },
    openPath: async (path) => {
      calls.push(`openPath ${path}`)
      return { status: 'failed', message: '없음' }
    },
    saveFile: async (request) => {
      calls.push(`saveFile path=${request.path} saveAs=${request.saveAs}`)
      return { status: 'saved', path: request.path ?? '/notes/new.md', directory: '/notes', format: 'md' }
    },
    confirmDiscard: async () => {
      calls.push('confirmDiscard')
      return 'cancel'
    },
    ...overrides,
  }
  return { api, calls }
}

function setup(api: CommandsApi, { lock = createCommandLock(), openElsewhere = [] as string[] }: { lock?: CommandLock; openElsewhere?: string[] } = {}) {
  let text = ''
  let backupStaleCount = 0
  const focusedElsewhere: string[] = []
  const editor = { getText: () => text, setText: (next: string) => (text = next) }
  const documentState = createDocumentState('lf')
  const locations: (FileLocation | null)[] = []
  const commands = createDocumentCommands({
    api,
    lock,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: '/notes', defaultFormat: 'md' }),
    focusIfOpenElsewhere: (path) => {
      if (!openElsewhere.includes(path)) return false
      focusedElsewhere.push(path)
      return true
    },
    onFileLocationChanged: (location) => locations.push(location),
    onDocumentReplaced: () => undefined,
    onBackupStale: () => backupStaleCount++,
  })
  return {
    commands,
    documentState,
    locations,
    focusedElsewhere,
    backupStaleCount: () => backupStaleCount,
    type: (next: string) => (text = next),
    text: () => text,
  }
}

describe('새 문서', () => {
  it('변경이 없으면 묻지 않고 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    expect(await commands.newDocument()).toBe(true)
    expect(calls).not.toContain('confirmDiscard')
  })

  it('저장 안 한 변경이 있으면 새 문서 전에 저장할지 묻는다', async () => {
    const { api, calls } = createFakeApi()
    const { commands, type } = setup(api)
    type('쓰던 글')
    await commands.newDocument()
    expect(calls[0]).toBe('confirmDiscard')
  })

  it('저장을 고르면 저장한 뒤 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'save' })
    const { commands, type, text } = setup(api)
    type('쓰던 글')
    expect(await commands.newDocument()).toBe(true)
    expect(calls).toContain('saveFile path=null saveAs=false')
    expect(text()).toBe('')
  })

  it('저장 안 함을 고르면 저장하지 않고 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'discard' })
    const { commands, type, text } = setup(api)
    type('버릴 글')
    expect(await commands.newDocument()).toBe(true)
    expect(calls.some((call) => call.startsWith('saveFile'))).toBe(false)
    expect(text()).toBe('')
  })

  it('취소를 고르면 아무것도 바꾸지 않는다', async () => {
    const { api } = createFakeApi()
    const { commands, type, text } = setup(api)
    type('지키는 글')
    expect(await commands.newDocument()).toBe(false)
    expect(text()).toBe('지키는 글')
  })

  it('저장 창을 취소하면 새 문서를 열지 않는다', async () => {
    const { api } = createFakeApi({ confirmDiscard: async () => 'save', saveFile: async () => ({ status: 'canceled' }) })
    const { commands, type, text } = setup(api)
    type('지키는 글')
    expect(await commands.newDocument()).toBe(false)
    expect(text()).toBe('지키는 글')
  })

  it('새 문서를 열면 열린 파일이 없다고 알리고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, locations, backupStaleCount } = setup(api)
    await commands.newDocument()
    expect(locations.at(-1)).toBeNull()
    expect(backupStaleCount()).toBe(1)
  })
})

describe('저장', () => {
  it('저장하면 고른 경로와 형식을 알리고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, type, locations, backupStaleCount } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(true)
    expect(locations.at(-1)).toEqual({ path: '/notes/new.md', directory: '/notes', format: 'md', origin: 'saved' })
    expect(backupStaleCount()).toBe(1)
  })

  it('저장하고 나면 변경 없음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, type, documentState } = setup(api)
    type('새 글')
    await commands.save()
    expect(documentState.isDirty('새 글')).toBe(false)
  })

  it('저장에 실패하면 변경 상태를 그대로 두고 백업도 그대로 둔다', async () => {
    const { api } = createFakeApi({ saveFile: async () => ({ status: 'failed', message: '권한' }) })
    const { commands, type, documentState, backupStaleCount } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(false)
    expect(documentState.isDirty('새 글')).toBe(true)
    expect(backupStaleCount()).toBe(0)
  })

  it('경로가 있는 문서를 저장하면 그 경로로 저장을 요청한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands, type } = setup(api)
    await commands.open()
    type('# 고친 글')
    await commands.save()
    expect(calls).toContain('saveFile path=/notes/a.md saveAs=false')
  })

  it('다른 이름으로 저장은 저장 창을 띄우도록 요청한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    await commands.open()
    await commands.saveAs()
    expect(calls).toContain('saveFile path=/notes/a.md saveAs=true')
  })
})

describe('열기', () => {
  it('파일을 열면 에디터에 내용을 넣고 변경 없음 상태가 되며 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState, locations, backupStaleCount } = setup(api)
    expect(await commands.open()).toBe(true)
    expect(text()).toBe('# 열린 글')
    expect(documentState.isDirty('# 열린 글')).toBe(false)
    expect(locations.at(-1)).toMatchObject({ path: '/notes/a.md', origin: 'opened' })
    expect(backupStaleCount()).toBe(1)
  })

  it('마지막 파일 다시 열기에 실패하면 새 문서 그대로 둔다', async () => {
    const { api } = createFakeApi()
    const { commands, text } = setup(api)
    expect(await commands.openPath('/notes/gone.md')).toBe(false)
    expect(text()).toBe('')
  })
})

describe('복구', () => {
  it('저장 안 한 내용이 있는 칸을 복구하면 내용을 넣고 변경 있음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState } = setup(api)
    expect(await commands.restore({ path: '/notes/a.md', eol: 'lf', unsavedContent: '복구한 글' })).toBe(true)
    expect(text()).toBe('복구한 글')
    expect(documentState.isDirty('복구한 글')).toBe(true)
    expect(documentState.info().path).toBe('/notes/a.md')
  })

  it('변경 없던 칸을 복구하면 그 파일을 다시 연다', async () => {
    const { api, calls } = createFakeApi({
      openPath: async (path) => {
        calls.push(`openPath ${path}`)
        return openedResult
      },
    })
    const { commands, text } = setup(api)
    expect(await commands.restore({ path: '/notes/a.md', eol: 'lf', unsavedContent: null })).toBe(true)
    expect(calls).toContain('openPath /notes/a.md')
    expect(text()).toBe('# 열린 글')
  })

  it('변경 없던 칸의 파일이 없어졌으면 빈 새 문서로 둔다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState } = setup(api)
    expect(await commands.restore({ path: '/notes/gone.md', eol: 'lf', unsavedContent: null })).toBe(false)
    expect(text()).toBe('')
    expect(documentState.info().path).toBeNull()
  })
})

describe('닫기 확인', () => {
  it('변경이 없으면 묻지 않고 닫아도 된다고 답한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    expect(await commands.confirmClose()).toBe(true)
    expect(calls).toEqual([])
  })

  it('저장 안 함을 고르면 저장하지 않고 닫아도 된다고 답한다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'discard' })
    const { commands, type } = setup(api)
    type('버릴 글')
    expect(await commands.confirmClose()).toBe(true)
    expect(calls.some((call) => call.startsWith('saveFile'))).toBe(false)
  })

  it('저장을 골랐는데 저장 창을 취소하면 닫으면 안 된다고 답한다', async () => {
    const { api } = createFakeApi({ confirmDiscard: async () => 'save', saveFile: async () => ({ status: 'canceled' }) })
    const { commands, type } = setup(api)
    type('잃으면 안 되는 글')
    expect(await commands.confirmClose()).toBe(false)
  })
})

describe('다른 프로그램에서 열기', () => {
  it('저장 안 한 변경이 있으면 열기 전에 저장할지 묻는다', async () => {
    const { api, calls } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type } = setup(api)
    type('쓰던 글')
    await commands.openRequestedFile('/notes/a.md')
    expect(calls[0]).toBe('confirmDiscard')
  })

  it('취소하면 지금 문서를 그대로 둔다', async () => {
    const { api } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type, text } = setup(api)
    type('쓰던 글')
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(false)
    expect(text()).toBe('쓰던 글')
  })

  it('열지 못하면 이유를 보여 주도록 요청하고 지금 문서를 그대로 둔다', async () => {
    const requests: string[] = []
    const { api } = createFakeApi({
      openPath: async (path, options) => {
        requests.push(`${path} reportErrors=${options?.reportErrors}`)
        return { status: 'failed', message: '없음' }
      },
    })
    const { commands, text } = setup(api)
    expect(await commands.openRequestedFile('/notes/gone.md')).toBe(false)
    expect(requests).toEqual(['/notes/gone.md reportErrors=true'])
    expect(text()).toBe('')
  })

  it('열면 에디터에 내용을 넣고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi({ openPath: async () => openedResult })
    const { commands, text, locations, backupStaleCount } = setup(api)
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(true)
    expect(text()).toBe('# 열린 글')
    expect(backupStaleCount()).toBe(1)
    expect(locations.at(-1)).toMatchObject({ path: '/notes/a.md', origin: 'opened' })
  })
})

describe('다른 칸에 열린 파일', () => {
  it('다른 칸에 열린 파일을 열라는 요청이 오면 묻지도 열지도 않고 그 칸으로 옮긴다', async () => {
    const { api, calls } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type, text, focusedElsewhere } = setup(api, { openElsewhere: ['/notes/a.md'] })
    type('쓰던 글')
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(false)
    expect(calls).not.toContain('confirmDiscard')
    expect(focusedElsewhere).toEqual(['/notes/a.md'])
    expect(text()).toBe('쓰던 글')
  })

  it('열기 창에서 다른 칸에 열린 파일을 고르면 열지 않고 그 칸으로 옮긴다', async () => {
    const { api } = createFakeApi()
    const { commands, text, focusedElsewhere } = setup(api, { openElsewhere: ['/notes/a.md'] })
    expect(await commands.open()).toBe(false)
    expect(focusedElsewhere).toEqual(['/notes/a.md'])
    expect(text()).toBe('')
  })

  it('다시 열 파일이 다른 칸에 열려 있으면 열지 않는다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api, { openElsewhere: ['/notes/a.md'] })
    expect(await commands.openPath('/notes/a.md')).toBe(false)
    expect(calls).not.toContain('openPath /notes/a.md')
  })
})

describe('명령 겹침', () => {
  function pendingSave() {
    let finish: () => void = () => undefined
    const saveFile: CommandsApi['saveFile'] = (request) =>
      new Promise((resolve) => {
        finish = () => resolve({ status: 'saved', path: request.path ?? '/notes/new.md', directory: '/notes', format: 'md' })
      })
    return { saveFile, finish: () => finish() }
  }

  it('저장 창이 떠 있는 동안 다시 누른 저장은 무시한다', async () => {
    const pending = pendingSave()
    const saveFile = vi.fn(pending.saveFile)
    const { api } = createFakeApi({ saveFile })
    const { commands } = setup(api)
    const first = commands.save()
    expect(await commands.save()).toBe(false)
    pending.finish()
    expect(await first).toBe(true)
    expect(saveFile).toHaveBeenCalledTimes(1)
  })

  it('같은 잠금을 쓰는 다른 칸의 명령도 저장 창이 떠 있는 동안 무시한다', async () => {
    const pending = pendingSave()
    const lock = createCommandLock()
    const left = setup(createFakeApi({ saveFile: pending.saveFile }).api, { lock })
    const rightApi = createFakeApi()
    const right = setup(rightApi.api, { lock })
    const saving = left.commands.save()
    expect(await right.commands.open()).toBe(false)
    expect(rightApi.calls).not.toContain('openFileDialog')
    pending.finish()
    expect(await saving).toBe(true)
  })

  it('다른 프로그램에서 연 파일은 진행 중인 명령이 끝난 뒤에 연다', async () => {
    const pending = pendingSave()
    const { api, calls } = createFakeApi({
      saveFile: pending.saveFile,
      openPath: async (path) => {
        calls.push(`openPath ${path}`)
        return openedResult
      },
    })
    const { commands, text } = setup(api)
    const saving = commands.save()
    const opening = commands.openRequestedFile('/notes/a.md')
    await Promise.resolve()
    expect(calls).not.toContain('openPath /notes/a.md')
    pending.finish()
    await saving
    expect(await opening).toBe(true)
    expect(text()).toBe('# 열린 글')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/renderer/command-lock.test.ts tests/renderer/document-commands.test.ts tests/renderer/close-handler.test.ts`
Expected: FAIL (`command-lock` 모듈 없음, `confirmClose`/`restore` 없음, `closeWindow` 대신 `closeDocument`를 부름)

- [ ] **Step 3: 명령 잠금 구현**

`src/renderer/command-lock.ts`:

```ts
export type GuardedCommand<Args extends unknown[]> = (...args: Args) => Promise<boolean>

export type CommandLock = {
  unlessBusy<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
  afterRunning<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
}

export function createCommandLock(): CommandLock {
  let running: Promise<boolean> | null = null

  function track(command: Promise<boolean>): Promise<boolean> {
    running = command
    const clear = () => {
      if (running === command) running = null
    }
    command.then(clear, clear)
    return command
  }

  // 저장 창 같은 대화 상자가 떠 있는 동안 단축키를 또 누르면 창이 겹쳐 뜨므로, 진행 중인 명령이 있으면 무시한다.
  function unlessBusy<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args> {
    return (...args) => (running ? Promise.resolve(false) : track(command(...args)))
  }

  // 다른 프로그램에서 연 파일은 다시 요청할 방법이 없으므로 버리지 않고 진행 중인 명령이 끝나기를 기다린다.
  function afterRunning<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args> {
    return async (...args) => {
      while (running) await running.catch(() => false)
      return track(command(...args))
    }
  }

  return { unlessBusy, afterRunning }
}
```

- [ ] **Step 4: 문서 명령 구현**

`src/renderer/document-commands.ts` 전체:

```ts
import type { ImworkingApi, OpenedFile } from '../shared/api'
import type { FileFormat, PaneBackup } from '../shared/types'
import type { CommandLock } from './command-lock'
import type { DocumentState } from './document-state'

export type TextSource = { getText(): string; setText(text: string): void }

export type FileLocation = { path: string; directory: string; format: FileFormat; origin: 'opened' | 'saved' }

export type CommandsApi = Pick<ImworkingApi, 'openFileDialog' | 'openPath' | 'saveFile' | 'confirmDiscard'>

export type DocumentCommandsDeps = {
  api: CommandsApi
  lock: CommandLock
  editor: TextSource
  documentState: DocumentState
  savePreferences(): { defaultDirectory: string | null; defaultFormat: FileFormat }
  // 같은 파일을 두 칸에서 따로 저장하면 서로 덮어쓰므로, 이미 다른 칸에 열려 있으면 그 칸으로 옮기고 true를 돌려준다.
  focusIfOpenElsewhere(path: string): boolean
  onFileLocationChanged(location: FileLocation | null): void
  onDocumentReplaced(): void
  onBackupStale(): void
}

export type DocumentCommands = {
  newDocument(): Promise<boolean>
  open(): Promise<boolean>
  save(): Promise<boolean>
  saveAs(): Promise<boolean>
  confirmClose(): Promise<boolean>
  openPath(path: string): Promise<boolean>
  openRequestedFile(path: string): Promise<boolean>
  restore(backup: PaneBackup): Promise<boolean>
}

export function createDocumentCommands(deps: DocumentCommandsDeps): DocumentCommands {
  const { api, lock, editor, documentState } = deps

  async function saveDocument(saveAs: boolean): Promise<boolean> {
    const text = editor.getText()
    const { path, eol } = documentState.info()
    const { defaultDirectory, defaultFormat } = deps.savePreferences()
    const result = await api.saveFile({ path, text, eol, saveAs, defaultDirectory, defaultFormat })
    if (result.status !== 'saved') return false
    documentState.markSaved({ path: result.path, format: result.format }, text)
    deps.onFileLocationChanged({ path: result.path, directory: result.directory, format: result.format, origin: 'saved' })
    deps.onBackupStale()
    return true
  }

  async function resolveUnsavedChanges(): Promise<boolean> {
    if (!documentState.isDirty(editor.getText())) return true
    const choice = await api.confirmDiscard()
    if (choice === 'save') return saveDocument(false)
    return choice === 'discard'
  }

  function showOpenedFile(file: OpenedFile): void {
    documentState.loadFromFile(file)
    editor.setText(file.text)
    deps.onDocumentReplaced()
    deps.onFileLocationChanged({ path: file.path, directory: file.directory, format: file.format, origin: 'opened' })
  }

  async function openSilently(path: string): Promise<boolean> {
    if (deps.focusIfOpenElsewhere(path)) return false
    const result = await api.openPath(path)
    if (result.status !== 'opened') return false
    showOpenedFile(result.file)
    return true
  }

  return {
    newDocument: lock.unlessBusy(async () => {
      if (!(await resolveUnsavedChanges())) return false
      documentState.startNew()
      editor.setText('')
      deps.onDocumentReplaced()
      deps.onFileLocationChanged(null)
      deps.onBackupStale()
      return true
    }),

    open: lock.unlessBusy(async () => {
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openFileDialog(deps.savePreferences().defaultDirectory)
      if (result.status !== 'opened' || deps.focusIfOpenElsewhere(result.file.path)) return false
      showOpenedFile(result.file)
      deps.onBackupStale()
      return true
    }),

    save: lock.unlessBusy(() => saveDocument(false)),

    saveAs: lock.unlessBusy(() => saveDocument(true)),

    confirmClose: lock.unlessBusy(resolveUnsavedChanges),

    openPath: lock.unlessBusy(openSilently),

    openRequestedFile: lock.afterRunning(async (path: string) => {
      if (deps.focusIfOpenElsewhere(path)) return false
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openPath(path, { reportErrors: true })
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      deps.onBackupStale()
      return true
    }),

    restore: lock.unlessBusy(async (backup: PaneBackup) => {
      if (backup.unsavedContent === null) return backup.path === null ? false : openSilently(backup.path)
      documentState.loadUnsaved(backup)
      editor.setText(backup.unsavedContent)
      deps.onDocumentReplaced()
      return true
    }),
  }
}
```

- [ ] **Step 5: 창 닫기 처리 구현**

`src/renderer/close-handler.ts` 전체:

```ts
export type CloseHandlerDeps = {
  isStartupFinished(): boolean
  closeWindow(): Promise<boolean>
  closeWindowNow(): void
  pauseAutosave(): void
  resumeAutosave(): void
}

export function createCloseHandler(deps: CloseHandlerDeps): () => Promise<void> {
  return async () => {
    deps.pauseAutosave()
    // 복구 여부를 정하기 전에는 에디터가 비어 있어 "변경 없음"으로 보이므로, 창 닫기 흐름을 타면 백업이 지워진다.
    if (!deps.isStartupFinished()) {
      deps.closeWindowNow()
      return
    }
    if (!(await deps.closeWindow())) deps.resumeAutosave()
  }
}
```

- [ ] **Step 6: 임시 연결 (`src/renderer/app.ts`)**

1. import에 `import { createCommandLock } from './command-lock'`를 더한다.
2. `commandsApi`와 `commands` 블록을 아래로 바꾼다:

```ts
  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path, options) => api.openPath(path, options),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
  }

  const commands = createDocumentCommands({
    api: commandsApi,
    lock: createCommandLock(),
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
    focusIfOpenElsewhere: () => false,
    onFileLocationChanged: (location) => {
      if (!location) updateSettings({ openFiles: [] })
      else if (location.origin === 'saved')
        updateSettings({ openFiles: [location.path], lastDirectory: location.directory, defaultFormat: location.format })
      else updateSettings({ openFiles: [location.path], lastDirectory: location.directory })
      documentStatus.runNow()
    },
    onDocumentReplaced: () => documentStatus.runNow(),
    onBackupStale: () => void autosave.flushNow(),
  })
```

3. `createCloseHandler({...})`의 `closeDocument: () => commands.close(),` 줄을 아래로 바꾼다:

```ts
      closeWindow: async () => {
        if (!(await commands.confirmClose())) return false
        await api.clearBackup()
        api.closeWindowNow()
        return true
      },
```

4. 시작할 때 복구 줄 `if (restored && restoredPane) commands.restoreBackup(restoredPane)` → `if (restored && restoredPane) await commands.restore(restoredPane)`

- [ ] **Step 7: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/renderer/command-lock.ts src/renderer/document-commands.ts src/renderer/close-handler.ts src/renderer/app.ts tests/renderer/command-lock.test.ts tests/renderer/document-commands.test.ts tests/renderer/close-handler.test.ts
git commit -m "refactor: 문서 명령을 칸 하나 단위로 나누기" -m "명령 겹침 잠금을 command-lock으로 떼어 여러 칸이 하나를 함께 쓸 수 있게 한다. 문서 명령은 백업을 직접 지우거나 창을 닫지 않고, 백업을 고쳐 써야 한다고 알리고 이 칸을 닫아도 되는지만 답한다. 다른 칸에 이미 열린 파일은 열지 않고 그 칸으로 옮기며, 백업 칸 복구를 맡는다."
```

---

### Task 7: 칸 단축키와 끌어다 놓은 자리 (`shortcuts`, `file-drop`)

**Files:**
- Modify: `src/renderer/shortcuts.ts`, `src/renderer/file-drop.ts`
- Test: `tests/renderer/shortcuts.test.ts`, `tests/renderer/file-drop.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `APP_SHORTCUTS.addPane = 'Mod+\\'`, `APP_SHORTCUTS.closePane = 'Mod+W'`, `APP_SHORTCUTS.nextPane = 'Ctrl+Tab'`
  - 키 이름 `Tab`을 단축키 조합에 쓸 수 있다.
  - `FileDropOptions.onFileDropped(path: string, dropTarget: EventTarget | null): void`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/renderer/shortcuts.test.ts`의 `'은신 모드는 Mod+Shift+M으로 켜고 끈다'` 테스트 다음에 더한다:

```ts
  it('칸은 Ctrl+\\로 더하고 Ctrl+W로 닫고 Ctrl+Tab으로 옮긴다', () => {
    expect(matchesShortcut(press({ code: 'Backslash', ctrlKey: true }), APP_SHORTCUTS.addPane, 'win32')).toBe(true)
    expect(matchesShortcut(press({ code: 'KeyW', ctrlKey: true }), APP_SHORTCUTS.closePane, 'win32')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', ctrlKey: true }), APP_SHORTCUTS.nextPane, 'win32')).toBe(true)
  })

  it('맥에서 칸 더하기와 닫기는 Cmd를 쓰지만 칸 이동은 앱 전환 키를 피해 Ctrl+Tab이다', () => {
    expect(matchesShortcut(press({ code: 'Backslash', metaKey: true }), APP_SHORTCUTS.addPane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'KeyW', metaKey: true }), APP_SHORTCUTS.closePane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', ctrlKey: true }), APP_SHORTCUTS.nextPane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', metaKey: true }), APP_SHORTCUTS.nextPane, 'darwin')).toBe(false)
  })

  it('Tab 키도 단축키 조합에 쓸 수 있다', () => {
    expect(parseShortcut('Ctrl+Tab')).toEqual({ code: 'Tab', mod: false, ctrl: true, cmd: false, shift: false, alt: false })
  })
```

`tests/renderer/file-drop.test.ts`:

1. `setup` 함수를 아래로 바꾼다:

```ts
function setup() {
  const dropped: string[] = []
  const targets: (EventTarget | null)[] = []
  installFileDrop(document, {
    pathForFile: (file) => `C:\\notes\\${file.name}`,
    onFileDropped: (path, dropTarget) => {
      dropped.push(path)
      targets.push(dropTarget)
    },
  })
  return { dropped, targets }
}
```

2. 파일 끝 `})` 앞에 더한다:

```ts
  it('파일을 놓은 자리의 요소를 함께 알린다', () => {
    const { targets } = setup()
    const rightPane = document.createElement('div')
    document.body.append(rightPane)
    rightPane.dispatchEvent(dropEvent('drop', [new File(['x'], '요약.md')]))
    expect(targets.at(-1)).toBe(rightPane)
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/renderer/shortcuts.test.ts tests/renderer/file-drop.test.ts`
Expected: FAIL (`APP_SHORTCUTS.addPane`이 `undefined`, `Ctrl+Tab`을 해석하지 못함, 놓은 자리를 알리지 않음)

- [ ] **Step 3: 구현**

`src/renderer/shortcuts.ts`:

1. `APP_SHORTCUTS`의 `decreaseFontSize: 'Mod+-',` 다음에 더한다:

```ts
  addPane: 'Mod+\\',
  closePane: 'Mod+W',
  // macOS에서 Cmd+Tab은 앱 전환 키라서 두 OS 모두 Ctrl을 쓴다.
  nextPane: 'Ctrl+Tab',
```

2. `CODE_BY_SYMBOL` 아래에 더한다:

```ts
const CODE_BY_NAMED_KEY: Record<string, string> = {
  Tab: 'Tab',
}
```

3. `codeForKeyName`의 마지막 줄을 바꾼다:

```ts
  return CODE_BY_SYMBOL[keyName] ?? CODE_BY_NAMED_KEY[keyName] ?? null
```

`src/renderer/file-drop.ts` 전체:

```ts
export type FileDropOptions = {
  pathForFile(file: File): string
  onFileDropped(path: string, dropTarget: EventTarget | null): void
}

// 캡처 단계에서 받는다. 에디터가 먼저 받으면 파일 내용을 글 중간에 붙여 넣는다.
export function installFileDrop(target: Document, { pathForFile, onFileDropped }: FileDropOptions): void {
  target.addEventListener('dragover', (event) => event.preventDefault(), true)
  target.addEventListener(
    'drop',
    (event) => {
      const file = (event as DragEvent).dataTransfer?.files[0]
      event.preventDefault()
      if (!file) return
      event.stopPropagation()
      onFileDropped(pathForFile(file), event.target)
    },
    true,
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS (`앱 단축키와 기본 패닉 키는 서로 겹치지 않는다`도 그대로 통과), 타입 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/shortcuts.ts src/renderer/file-drop.ts tests/renderer/shortcuts.test.ts tests/renderer/file-drop.test.ts
git commit -m "feat: 칸 단축키와 파일을 놓은 자리 알리기" -m "칸 더하기 Ctrl+\\, 닫기 Ctrl+W, 이동 Ctrl+Tab을 더한다. 맥에서도 칸 이동은 앱 전환 키를 피해 Ctrl+Tab이다. 파일을 끌어다 놓으면 놓은 자리의 요소를 함께 알려 그 칸에 열 수 있게 한다."
```

---

### Task 8: 칸 하나 조립 (`editor` 보기 설정과 `destroy`, `document-pane`)

**Files:**
- Modify: `src/renderer/editor.ts`
- Create: `src/renderer/document-pane.ts`
- Modify: `src/renderer/app.ts` (임시 연결)
- Test: `tests/renderer/editor.test.ts`, `tests/renderer/document-pane.test.ts`

**Interfaces:**
- Consumes: `CommandLock` (Task 6), `DocumentCommands`, `DocumentCommandsDeps`, `CommandsApi`, `FileLocation` (Task 6), `DocumentState.snapshot` (Task 5), `StatusInfo`, `countCharacters` (`statusbar.ts`), `DebouncedTask` (`debounce.ts`)
- Produces:
  ```ts
  // editor.ts
  EditorOptions에 fontSize: number, lineNumbersVisible: boolean 추가
  Editor에 destroy(): void 추가
  // document-pane.ts
  export const DOCUMENT_STATUS_DELAY_MS = 150
  export type PaneStatus = Omit<StatusInfo, 'logPaused'>
  export type DocumentPane = {
    element: HTMLElement; commands: DocumentCommands
    filePath(): string | null; isDirty(): boolean; snapshot(): PaneBackup; status(): PaneStatus
    focus(): void; setFontSize(px: number): void; setSyntaxHighlight(enabled: boolean): void
    setLineNumbersVisible(visible: boolean): void; destroy(): void
  }
  export type DocumentPaneParts = {
    createEditor(options: EditorOptions): Editor
    createDocumentState(newDocumentEol: Eol): DocumentState
    createDocumentCommands(deps: DocumentCommandsDeps): DocumentCommands
    createDebouncedTask(run: () => void, delayMs: number): DebouncedTask
  }
  export type PaneDisplay = { syntaxHighlight: boolean; fontSize: number; lineNumbersVisible: boolean }
  export type DocumentPaneOptions = {
    doc: Document; parts: DocumentPaneParts; defaultEol: Eol; display: PaneDisplay
    api: CommandsApi; lock: CommandLock
    savePreferences(): { defaultDirectory: string | null; defaultFormat: FileFormat }
    focusIfOpenElsewhere(path: string): boolean
    onFileLocationChanged(location: FileLocation | null): void
    onBackupStale(): void; onStatusChanged(): void; onUserTyped(): void; onFocused(): void
  }
  export function createDocumentPane(options: DocumentPaneOptions): DocumentPane
  ```
- 칸을 만드는 동안에는 어떤 콜백도 부르지 않는다 (app이 칸 목록을 다 만들기 전에 콜백이 불리면 안 된다). 그래서 글꼴 크기와 줄번호 표시는 만든 뒤 바꾸지 않고 `createEditor`에 처음부터 넘긴다.
- `element`의 클래스는 `editor-pane`이다. 칸 안에서 `focusin`이 일어나면 `onFocused()`를 부른다.

- [ ] **Step 1: 실패하는 테스트 쓰기 (editor)**

`tests/renderer/editor.test.ts`:

1. `setup` 함수를 아래로 바꾼다:

```ts
function setup(initialText = '# 제목', display = { fontSize: 14, lineNumbersVisible: true }) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const changeNotices: unknown[][] = []
  const cursorPositions: CursorPosition[] = []
  let typedCount = 0
  const editor = createEditor({
    parent,
    initialText,
    syntaxHighlight: true,
    fontSize: display.fontSize,
    lineNumbersVisible: display.lineNumbersVisible,
    onTextChanged: (...args: unknown[]) => changeNotices.push(args),
    onCursorMoved: (position) => cursorPositions.push(position),
    onUserTyped: () => typedCount++,
  })
  const view = () => EditorView.findFromDOM(parent.querySelector('.cm-editor') as HTMLElement)!
  return { editor, parent, view, changeNotices, cursorPositions, typedCount: () => typedCount }
}
```

2. 파일 끝 `})` 앞에 더한다:

```ts
  it('처음 받은 글꼴 크기와 줄 번호 표시로 시작한다', () => {
    const { view } = setup('', { fontSize: 20, lineNumbersVisible: false })
    expect(getComputedStyle(view().dom).fontSize).toBe('20px')
    expect(view().dom.querySelector('.cm-visual-line-numbers')).toBeNull()
  })

  it('없애면 에디터가 화면에서 사라진다', () => {
    const { editor, parent } = setup()
    editor.destroy()
    expect(parent.querySelector('.cm-editor')).toBeNull()
  })
```

- [ ] **Step 2: 실패하는 테스트 쓰기 (document-pane)**

`tests/renderer/document-pane.test.ts`:

```ts
// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommandLock } from '../../src/renderer/command-lock'
import { createDebouncedTask } from '../../src/renderer/debounce'
import { createDocumentCommands, type CommandsApi } from '../../src/renderer/document-commands'
import { DOCUMENT_STATUS_DELAY_MS, createDocumentPane } from '../../src/renderer/document-pane'
import { createDocumentState } from '../../src/renderer/document-state'
import { createEditor } from '../../src/renderer/editor'
import type { OpenedFile } from '../../src/shared/api'

afterEach(() => {
  vi.useRealTimers()
})

const openedFile: OpenedFile = {
  path: '/notes/a.md',
  directory: '/notes',
  text: '# 열린 글',
  eol: 'lf',
  encoding: 'utf-8',
  format: 'md',
}

function setup({ openElsewhere = false, lineNumbersVisible = false } = {}) {
  const events: string[] = []
  const api: CommandsApi = {
    openFileDialog: async () => ({ status: 'canceled' }),
    openPath: async () => ({ status: 'opened', file: openedFile }),
    saveFile: async () => ({ status: 'canceled' }),
    confirmDiscard: async () => 'cancel',
  }
  const pane = createDocumentPane({
    doc: document,
    parts: { createEditor, createDocumentState, createDocumentCommands, createDebouncedTask },
    defaultEol: 'lf',
    display: { syntaxHighlight: false, fontSize: 14, lineNumbersVisible },
    api,
    lock: createCommandLock(),
    savePreferences: () => ({ defaultDirectory: null, defaultFormat: 'md' }),
    focusIfOpenElsewhere: () => openElsewhere,
    onFileLocationChanged: (location) => events.push(`location ${location?.path ?? null}`),
    onBackupStale: () => events.push('backupStale'),
    onStatusChanged: () => events.push('status'),
    onUserTyped: () => events.push('typed'),
    onFocused: () => events.push('focused'),
  })
  document.body.append(pane.element)
  const view = () => EditorView.findFromDOM(pane.element.querySelector('.cm-editor') as HTMLElement)!
  return { pane, events, view }
}

describe('글 칸', () => {
  it('새 칸은 빈 새 문서이고 만드는 동안 아무것도 알리지 않는다', () => {
    const { pane, events } = setup()
    expect(pane.element.classList.contains('editor-pane')).toBe(true)
    expect(pane.filePath()).toBeNull()
    expect(pane.isDirty()).toBe(false)
    expect(pane.status()).toMatchObject({ fileName: null, dirty: false, characters: 0, encoding: 'utf-8' })
    expect(events).toEqual([])
  })

  it('파일을 열면 칸의 파일 경로와 상태가 그 파일을 따른다', async () => {
    const { pane, events } = setup()
    expect(await pane.commands.openPath('/notes/a.md')).toBe(true)
    expect(pane.filePath()).toBe('/notes/a.md')
    expect(pane.status()).toMatchObject({ fileName: 'a.md', dirty: false, characters: 6 })
    expect(events).toContain('location /notes/a.md')
  })

  it('다른 칸에 열린 파일이면 이 칸에 열지 않는다', async () => {
    const { pane } = setup({ openElsewhere: true })
    expect(await pane.commands.openPath('/notes/a.md')).toBe(false)
    expect(pane.filePath()).toBeNull()
  })

  it('글을 고치면 바로 변경 있음으로 답하고, 상태바 정보는 입력이 잠깐 멈춘 뒤에 바뀐다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { pane, view, events } = setup()
    view().dispatch({ changes: { from: 0, insert: '가나' }, userEvent: 'input.type' })
    expect(pane.isDirty()).toBe(true)
    expect(pane.status().dirty).toBe(false)
    expect(events).toContain('typed')
    vi.advanceTimersByTime(DOCUMENT_STATUS_DELAY_MS)
    expect(pane.status()).toMatchObject({ dirty: true, characters: 2 })
    expect(events.at(-1)).toBe('status')
  })

  it('스냅샷은 칸의 경로, 줄바꿈, 저장 안 한 내용을 담는다', () => {
    const { pane, view } = setup()
    view().dispatch({ changes: { from: 0, insert: '새 글' } })
    expect(pane.snapshot()).toEqual({ path: null, eol: 'lf', unsavedContent: '새 글' })
  })

  it('칸 안으로 커서가 들어오면 지금 칸이 되었다고 알린다', () => {
    const { pane, events } = setup()
    pane.element.querySelector('.cm-content')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(events).toContain('focused')
  })

  it('보기 설정을 처음부터 받고, 바꾸면 칸의 에디터에 적용한다', () => {
    const { pane } = setup({ lineNumbersVisible: false })
    expect(pane.element.querySelector('.cm-visual-line-numbers')).toBeNull()
    pane.setLineNumbersVisible(true)
    expect(pane.element.querySelector('.cm-visual-line-numbers')).not.toBeNull()
  })

  it('칸을 없애면 화면에서 사라진다', () => {
    const { pane } = setup()
    pane.destroy()
    expect(pane.element.isConnected).toBe(false)
    expect(pane.element.querySelector('.cm-editor')).toBeNull()
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/renderer/editor.test.ts tests/renderer/document-pane.test.ts`
Expected: FAIL (`editor.destroy is not a function`, 처음 글꼴 크기 14px, `document-pane` 모듈 없음)

- [ ] **Step 4: 에디터 구현**

`src/renderer/editor.ts`:

1. `Editor` 타입에 `destroy(): void`를 `focus(): void` 다음 줄에 더한다.
2. `EditorOptions`의 `syntaxHighlight: boolean` 다음에 두 줄을 더한다:

```ts
  fontSize: number
  lineNumbersVisible: boolean
```

3. `const DEFAULT_FONT_SIZE_PX = 14` 줄을 지운다.
4. `createEditor` 안의 두 변수 줄을 바꾼다:
   - `let lineNumbersVisible = true` → `let lineNumbersVisible = options.lineNumbersVisible`
   - `let fontSizePx = DEFAULT_FONT_SIZE_PX` → `let fontSizePx = options.fontSize`
5. 반환 객체의 `focus: () => view.focus(),` 다음에 더한다:

```ts
    destroy: () => view.destroy(),
```

- [ ] **Step 5: 칸 하나 구현**

`src/renderer/document-pane.ts`:

```ts
import type { Eol, FileFormat, PaneBackup } from '../shared/types'
import type { CommandLock } from './command-lock'
import type { DebouncedTask } from './debounce'
import type { CommandsApi, DocumentCommands, DocumentCommandsDeps, FileLocation } from './document-commands'
import type { DocumentState } from './document-state'
import type { CursorPosition, Editor, EditorOptions } from './editor'
import { countCharacters, type StatusInfo } from './statusbar'

export const DOCUMENT_STATUS_DELAY_MS = 150

export type PaneStatus = Omit<StatusInfo, 'logPaused'>

export type DocumentPane = {
  element: HTMLElement
  commands: DocumentCommands
  filePath(): string | null
  isDirty(): boolean
  snapshot(): PaneBackup
  status(): PaneStatus
  focus(): void
  setFontSize(px: number): void
  setSyntaxHighlight(enabled: boolean): void
  setLineNumbersVisible(visible: boolean): void
  destroy(): void
}

export type DocumentPaneParts = {
  createEditor(options: EditorOptions): Editor
  createDocumentState(newDocumentEol: Eol): DocumentState
  createDocumentCommands(deps: DocumentCommandsDeps): DocumentCommands
  createDebouncedTask(run: () => void, delayMs: number): DebouncedTask
}

export type PaneDisplay = { syntaxHighlight: boolean; fontSize: number; lineNumbersVisible: boolean }

export type DocumentPaneOptions = {
  doc: Document
  parts: DocumentPaneParts
  defaultEol: Eol
  display: PaneDisplay
  api: CommandsApi
  lock: CommandLock
  savePreferences(): { defaultDirectory: string | null; defaultFormat: FileFormat }
  focusIfOpenElsewhere(path: string): boolean
  onFileLocationChanged(location: FileLocation | null): void
  onBackupStale(): void
  onStatusChanged(): void
  onUserTyped(): void
  onFocused(): void
}

export function createDocumentPane(options: DocumentPaneOptions): DocumentPane {
  const { parts } = options
  const element = options.doc.createElement('div')
  element.className = 'editor-pane'
  const documentState = parts.createDocumentState(options.defaultEol)
  let cursor: CursorPosition = { line: 1, column: 1 }
  let stats = { dirty: false, characters: 0 }

  // 글 전체를 읽어 세는 일은 큰 글에서 무거우므로, 입력할 때마다 하지 않고 입력이 잠깐 멈췄을 때 한다.
  const statsTask = parts.createDebouncedTask(() => {
    const text = editor.getText()
    stats = { dirty: documentState.isDirty(text), characters: countCharacters(text) }
    options.onStatusChanged()
  }, DOCUMENT_STATUS_DELAY_MS)

  const editor = parts.createEditor({
    parent: element,
    initialText: '',
    syntaxHighlight: options.display.syntaxHighlight,
    fontSize: options.display.fontSize,
    lineNumbersVisible: options.display.lineNumbersVisible,
    onTextChanged: () => statsTask.schedule(),
    onCursorMoved: (position) => {
      cursor = position
      options.onStatusChanged()
    },
    onUserTyped: () => options.onUserTyped(),
  })

  const commands = parts.createDocumentCommands({
    api: options.api,
    lock: options.lock,
    editor,
    documentState,
    savePreferences: () => options.savePreferences(),
    focusIfOpenElsewhere: (path) => options.focusIfOpenElsewhere(path),
    onFileLocationChanged: (location) => {
      statsTask.runNow()
      options.onFileLocationChanged(location)
    },
    onDocumentReplaced: () => statsTask.runNow(),
    onBackupStale: () => options.onBackupStale(),
  })

  element.addEventListener('focusin', () => options.onFocused())

  return {
    element,
    commands,
    filePath: () => documentState.info().path,
    isDirty: () => documentState.isDirty(editor.getText()),
    snapshot: () => documentState.snapshot(editor.getText()),
    status: () => ({
      fileName: documentState.fileName(),
      dirty: stats.dirty,
      line: cursor.line,
      column: cursor.column,
      characters: stats.characters,
      encoding: documentState.info().encoding,
    }),
    focus: () => editor.focus(),
    setFontSize: (px) => editor.setFontSize(px),
    setSyntaxHighlight: (enabled) => editor.setSyntaxHighlight(enabled),
    setLineNumbersVisible: (visible) => editor.setLineNumbersVisible(visible),
    destroy() {
      editor.destroy()
      element.remove()
    },
  }
}
```

- [ ] **Step 6: 임시 연결 (`src/renderer/app.ts`)**

`createEditor({...})` 호출의 `syntaxHighlight: settings.syntaxHighlight,` 다음에 두 줄을 더한다:

```ts
    fontSize: settings.fontSize,
    lineNumbersVisible: !settings.stealthMode,
```

- [ ] **Step 7: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/renderer/editor.ts src/renderer/document-pane.ts src/renderer/app.ts tests/renderer/editor.test.ts tests/renderer/document-pane.test.ts
git commit -m "feat: 글 칸 하나를 조립하는 document-pane" -m "에디터, 문서 상태, 문서 명령, 상태바 정보 세기를 칸 하나로 묶는다. 만드는 함수는 인자로 받는다. 에디터는 처음부터 글꼴 크기와 줄번호 표시를 받아, 은신 모드에서 새로 더한 칸에도 줄번호가 보이지 않게 한다."
```

---

### Task 9: 여러 칸에 걸친 흐름 (`workspace-commands`)

**Files:**
- Create: `src/renderer/workspace-commands.ts`
- Test: `tests/renderer/workspace-commands.test.ts`

**Interfaces:**
- Consumes: `PaneSet<P>`, `createPaneSet` (Task 3, 테스트에서 사용), `isSamePath` (Task 3), `DocumentCommands` (Task 6), `BackupSet`, `PaneBackup` (Task 5)
- Produces:
  ```ts
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
    focusPaneWithFile(path: string, except: WorkspacePane): boolean
    openRequestedFile(path: string, target?: WorkspacePane): Promise<boolean>
    restore(backup: BackupSet): Promise<void>
    reopen(paths: readonly string[]): Promise<void>
  }
  export type WorkspaceDeps = {
    panes: PaneSet<WorkspacePane>
    maxPanes: number
    onBackupStale(): void
    clearBackup(): Promise<void>
    closeWindowNow(): void
  }
  export function panesToRestore(panes: readonly PaneBackup[], maxPanes: number): PaneBackup[]
  export function createWorkspaceCommands(deps: WorkspaceDeps): WorkspaceCommands
  ```
- `DocumentPane`(Task 8)은 구조상 `WorkspacePane`을 만족하므로 app에서 `PaneSet<DocumentPane>`을 그대로 넘긴다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/renderer/workspace-commands.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createPaneSet } from '../../src/renderer/pane-set'
import { createWorkspaceCommands, panesToRestore, type WorkspacePane } from '../../src/renderer/workspace-commands'
import type { PaneBackup } from '../../src/shared/types'

type FakePane = WorkspacePane & { name: string; state: { path: string | null; dirty: boolean; closeAnswer: boolean } }

function setup({ maxPanes = 2 } = {}) {
  const log: string[] = []
  const missing = new Set<string>()
  let created = 0

  function createFakePane(): FakePane {
    const name = `pane${++created}`
    const state = { path: null as string | null, dirty: false, closeAnswer: true }
    return {
      name,
      state,
      filePath: () => state.path,
      isDirty: () => state.dirty,
      focus: () => log.push(`${name} focus`),
      commands: {
        confirmClose: async () => {
          log.push(`${name} confirmClose`)
          return state.closeAnswer
        },
        openPath: async (path) => {
          log.push(`${name} openPath ${path}`)
          if (missing.has(path)) return false
          state.path = path
          return true
        },
        openRequestedFile: async (path) => {
          log.push(`${name} openRequestedFile ${path}`)
          state.path = path
          return true
        },
        restore: async (backup) => {
          log.push(`${name} restore ${backup.unsavedContent ?? backup.path}`)
          if (backup.unsavedContent === null && backup.path !== null && missing.has(backup.path)) return false
          state.path = backup.path
          state.dirty = backup.unsavedContent !== null
          return true
        },
      },
    }
  }

  const panes = createPaneSet<FakePane>({
    maxPanes,
    createPane: createFakePane,
    destroyPane: (pane) => log.push(`${pane.name} destroy`),
    onChanged: () => undefined,
  })
  const workspace = createWorkspaceCommands({
    panes,
    maxPanes,
    onBackupStale: () => log.push('backupStale'),
    clearBackup: async () => {
      log.push('clearBackup')
    },
    closeWindowNow: () => log.push('closeWindowNow'),
  })
  const names = () => panes.all().map((pane) => pane.name)
  const paneNamed = (name: string) => panes.all().find((pane) => pane.name === name)!
  const logFrom = (start: number) => log.slice(start)
  return { panes, workspace, log, missing, names, paneNamed, logFrom }
}

const pane = (path: string | null, unsavedContent: string | null): PaneBackup => ({ path, eol: 'lf', unsavedContent })

describe('칸 더하기와 닫기', () => {
  it('칸을 더하면 새 칸으로 커서를 옮긴다', () => {
    const { workspace, names, log } = setup()
    expect(workspace.addPane()).toBe(true)
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log.at(-1)).toBe('pane2 focus')
  })

  it('최대 칸 수면 칸을 더하지 않는다', () => {
    const { workspace, names } = setup({ maxPanes: 2 })
    workspace.addPane()
    expect(workspace.addPane()).toBe(false)
    expect(names()).toEqual(['pane1', 'pane2'])
  })

  it('칸이 하나뿐이면 닫지 않는다', async () => {
    const { workspace, log } = setup()
    expect(await workspace.closeFocusedPane()).toBe(false)
    expect(log).not.toContain('pane1 confirmClose')
  })

  it('지금 칸을 닫으면 저장 확인을 거쳐 없애고 남은 칸으로 커서를 옮긴 뒤 백업을 고쳐 쓰게 한다', async () => {
    const { workspace, names, log, logFrom } = setup()
    workspace.addPane()
    const start = log.length
    expect(await workspace.closeFocusedPane()).toBe(true)
    expect(names()).toEqual(['pane1'])
    expect(logFrom(start)).toEqual(['pane2 confirmClose', 'pane2 destroy', 'pane1 focus', 'backupStale'])
  })

  it('닫기 확인에서 취소하면 칸을 닫지 않는다', async () => {
    const { workspace, names, paneNamed, log } = setup()
    workspace.addPane()
    paneNamed('pane2').state.closeAnswer = false
    expect(await workspace.closeFocusedPane()).toBe(false)
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log).not.toContain('backupStale')
  })
})

describe('창 닫기', () => {
  it('저장 안 한 칸마다 왼쪽부터 그 칸으로 옮겨 묻고, 모두 정리되면 백업을 지우고 닫는다', async () => {
    const { workspace, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    paneNamed('pane1').state.dirty = true
    paneNamed('pane2').state.dirty = true
    const start = log.length
    expect(await workspace.closeWindow()).toBe(true)
    expect(logFrom(start)).toEqual([
      'pane1 focus',
      'pane1 confirmClose',
      'pane2 focus',
      'pane2 confirmClose',
      'clearBackup',
      'closeWindowNow',
    ])
  })

  it('변경 없는 칸은 그 칸으로 옮기지 않는다', async () => {
    const { workspace, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    paneNamed('pane2').state.dirty = true
    const start = log.length
    await workspace.closeWindow()
    expect(logFrom(start)).toEqual(['pane1 confirmClose', 'pane2 focus', 'pane2 confirmClose', 'clearBackup', 'closeWindowNow'])
  })

  it('어느 칸에서든 취소하면 창을 닫지 않고 남은 칸은 묻지 않는다', async () => {
    const { workspace, paneNamed, log } = setup()
    workspace.addPane()
    paneNamed('pane1').state.dirty = true
    paneNamed('pane1').state.closeAnswer = false
    paneNamed('pane2').state.dirty = true
    expect(await workspace.closeWindow()).toBe(false)
    expect(log).not.toContain('pane2 confirmClose')
    expect(log).not.toContain('clearBackup')
    expect(log).not.toContain('closeWindowNow')
  })
})

describe('같은 파일 찾기', () => {
  it('다른 칸에 같은 파일이 열려 있으면 대소문자가 달라도 그 칸으로 옮긴다', () => {
    const { workspace, panes, paneNamed, log } = setup()
    paneNamed('pane1').state.path = 'C:\\notes\\a.md'
    workspace.addPane()
    expect(workspace.focusPaneWithFile('c:\\NOTES\\A.md', paneNamed('pane2'))).toBe(true)
    expect(panes.focused()).toBe(paneNamed('pane1'))
    expect(log.at(-1)).toBe('pane1 focus')
  })

  it('그 파일을 연 칸이 자기 칸뿐이면 찾지 못한다', () => {
    const { workspace, paneNamed } = setup()
    paneNamed('pane1').state.path = 'C:\\notes\\a.md'
    expect(workspace.focusPaneWithFile('C:\\notes\\a.md', paneNamed('pane1'))).toBe(false)
  })

  it('아무 칸에도 없는 파일은 찾지 못한다', () => {
    const { workspace, paneNamed } = setup()
    workspace.addPane()
    expect(workspace.focusPaneWithFile('C:\\notes\\b.md', paneNamed('pane2'))).toBe(false)
  })
})

describe('다른 프로그램에서 연 파일', () => {
  it('대상 칸을 정하지 않으면 지금 칸에 연다', async () => {
    const { workspace, log } = setup()
    await workspace.openRequestedFile('C:\\notes\\a.md')
    expect(log.at(-1)).toBe('pane1 openRequestedFile C:\\notes\\a.md')
  })

  it('대상 칸을 정하면 그 칸으로 옮겨 연다', async () => {
    const { workspace, panes, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    const start = log.length
    await workspace.openRequestedFile('C:\\notes\\a.md', paneNamed('pane1'))
    expect(logFrom(start)).toEqual(['pane1 focus', 'pane1 openRequestedFile C:\\notes\\a.md'])
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })
})

describe('복구', () => {
  it('백업의 칸 순서대로 칸을 열어 복구하고 첫 칸으로 커서를 옮긴다', async () => {
    const { workspace, panes, names, paneNamed, log } = setup()
    await workspace.restore({ savedAt: '2026-10-09T00:00:00.000Z', panes: [pane('/a.md', '글 A'), pane('/b.md', null)] })
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log).toContain('pane1 restore 글 A')
    expect(log).toContain('pane2 restore /b.md')
    expect(log.at(-1)).toBe('pane1 focus')
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('복구할 칸의 파일이 없어졌어도 칸은 남겨 배치를 지킨다', async () => {
    const { workspace, names, missing } = setup()
    missing.add('/b.md')
    await workspace.restore({ savedAt: '2026-10-09T00:00:00.000Z', panes: [pane('/a.md', '글 A'), pane('/b.md', null)] })
    expect(names()).toEqual(['pane1', 'pane2'])
  })

  it('백업 칸이 최대 칸 수보다 많으면 저장 안 한 칸을 우선해서 원래 순서대로 고른다', () => {
    const backups = [pane('/a.md', null), pane('/b.md', '글 B'), pane('/c.md', null), pane('/d.md', '글 D')]
    expect(panesToRestore(backups, 2).map((backup) => backup.path)).toEqual(['/b.md', '/d.md'])
    expect(panesToRestore(backups, 3).map((backup) => backup.path)).toEqual(['/a.md', '/b.md', '/d.md'])
    expect(panesToRestore(backups.slice(0, 2), 2)).toEqual(backups.slice(0, 2))
  })
})

describe('다시 열기', () => {
  it('마지막에 열려 있던 파일들을 칸 순서대로 열고 첫 칸으로 커서를 옮긴다', async () => {
    const { workspace, panes, names, paneNamed } = setup()
    await workspace.reopen(['/a.md', '/b.md'])
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(paneNamed('pane1').state.path).toBe('/a.md')
    expect(paneNamed('pane2').state.path).toBe('/b.md')
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('첫 파일이 없어졌으면 건너뛰고 다음 파일을 첫 칸에 연다', async () => {
    const { workspace, names, paneNamed, missing } = setup()
    missing.add('/a.md')
    await workspace.reopen(['/a.md', '/b.md'])
    expect(names()).toEqual(['pane1'])
    expect(paneNamed('pane1').state.path).toBe('/b.md')
  })

  it('둘째 파일이 없어졌으면 그 칸을 남기지 않는다', async () => {
    const { workspace, names, missing, log } = setup()
    missing.add('/gone.md')
    await workspace.reopen(['/a.md', '/gone.md'])
    expect(names()).toEqual(['pane1'])
    expect(log).toContain('pane2 destroy')
  })

  it('열 파일이 없으면 빈 칸 하나로 시작한다', async () => {
    const { workspace, names } = setup()
    await workspace.reopen([])
    expect(names()).toEqual(['pane1'])
  })

  it('최대 칸 수가 3이면 세 파일을 세 칸에 연다', async () => {
    const { workspace, names } = setup({ maxPanes: 3 })
    await workspace.reopen(['/a.md', '/b.md', '/c.md'])
    expect(names()).toEqual(['pane1', 'pane2', 'pane3'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/renderer/workspace-commands.test.ts`
Expected: FAIL (`workspace-commands` 모듈 없음)

- [ ] **Step 3: 구현**

`src/renderer/workspace-commands.ts`:

```ts
import { isSamePath } from '../shared/panes'
import type { BackupSet, PaneBackup } from '../shared/types'
import type { DocumentCommands } from './document-commands'
import type { PaneSet } from './pane-set'

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
  focusPaneWithFile(path: string, except: WorkspacePane): boolean
  openRequestedFile(path: string, target?: WorkspacePane): Promise<boolean>
  restore(backup: BackupSet): Promise<void>
  reopen(paths: readonly string[]): Promise<void>
}

export type WorkspaceDeps = {
  panes: PaneSet<WorkspacePane>
  maxPanes: number
  onBackupStale(): void
  clearBackup(): Promise<void>
  closeWindowNow(): void
}

export function panesToRestore(panes: readonly PaneBackup[], maxPanes: number): PaneBackup[] {
  if (panes.length <= maxPanes) return [...panes]
  const unsavedFirst = [
    ...panes.filter((pane) => pane.unsavedContent !== null),
    ...panes.filter((pane) => pane.unsavedContent === null),
  ]
  const kept = new Set(unsavedFirst.slice(0, maxPanes))
  return panes.filter((pane) => kept.has(pane))
}

export function createWorkspaceCommands(deps: WorkspaceDeps): WorkspaceCommands {
  const { panes } = deps

  function focus(pane: WorkspacePane): void {
    panes.focus(pane)
    pane.focus()
  }

  return {
    addPane() {
      const pane = panes.add()
      if (!pane) return false
      pane.focus()
      return true
    },

    async closeFocusedPane() {
      if (panes.all().length === 1) return false
      const pane = panes.focused()
      if (!(await pane.commands.confirmClose())) return false
      panes.remove(pane)
      panes.focused().focus()
      deps.onBackupStale()
      return true
    },

    async closeWindow() {
      for (const pane of [...panes.all()]) {
        if (pane.isDirty()) focus(pane)
        if (!(await pane.commands.confirmClose())) return false
      }
      await deps.clearBackup()
      deps.closeWindowNow()
      return true
    },

    focusPaneWithFile(path, except) {
      const pane = panes.all().find((candidate) => {
        const candidatePath = candidate.filePath()
        return candidate !== except && candidatePath !== null && isSamePath(candidatePath, path)
      })
      if (!pane) return false
      focus(pane)
      return true
    },

    openRequestedFile(path, target = panes.focused()) {
      if (target !== panes.focused()) focus(target)
      return target.commands.openRequestedFile(path)
    },

    async restore(backup) {
      for (const [index, paneBackup] of panesToRestore(backup.panes, deps.maxPanes).entries()) {
        const pane = index === 0 ? panes.focused() : panes.add()
        if (!pane) break
        await pane.commands.restore(paneBackup)
      }
      focus(panes.all()[0])
    },

    async reopen(paths) {
      let opened = 0
      for (const path of paths) {
        const pane = opened === 0 ? panes.focused() : panes.add()
        if (!pane) break
        if (await pane.commands.openPath(path)) opened++
        else if (opened > 0) panes.remove(pane)
      }
      focus(panes.all()[0])
    },
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/renderer/workspace-commands.test.ts && npm run typecheck`
Expected: PASS (21 tests), 타입 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/workspace-commands.ts tests/renderer/workspace-commands.test.ts
git commit -m "feat: 여러 칸에 걸친 흐름 workspace-commands" -m "칸 더하기와 닫기, 저장 안 한 칸을 왼쪽부터 묻는 창 닫기, 같은 파일을 연 칸 찾기, 놓은 칸에 열기, 백업 복구, 지난 파일 다시 열기를 칸의 작은 인터페이스로만 다룬다. 칸 수에 묶이지 않아 최대 칸 수가 3이어도 그대로 동작한다."
```

---

### Task 10: 칸 배치와 세로 막대 (`pane-dividers`, CSS)

**Files:**
- Create: `src/renderer/pane-dividers.ts`
- Modify: `src/renderer/styles.css`
- Test: `tests/renderer/pane-dividers.test.ts`

**Interfaces:**
- Consumes: `widthsAfterDrag` (Task 2)
- Produces:
  ```ts
  export const PANE_DIVIDER_PX = 6
  export type PaneLayout = {
    render(paneElements: readonly HTMLElement[], widths: readonly number[]): void
    hostWidth(): number
  }
  export type PaneLayoutOptions = { host: HTMLElement; minPanePx: number; onWidthsCommitted(widths: number[]): void }
  export function createPaneLayout(options: PaneLayoutOptions): PaneLayout
  ```
- `render`는 `host`의 자식을 `[칸0, 막대0, 칸1, 막대1, …]`로 맞추고, 열 너비를 `minmax(0, <비율>fr) 6px minmax(0, <비율>fr)`로 정한다. 이미 제자리에 있는 칸 요소는 옮기지 않는다.
- 막대는 클래스 `pane-divider`, `role="separator"`, `aria-orientation="vertical"`.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`tests/renderer/pane-dividers.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PANE_DIVIDER_PX, createPaneLayout } from '../../src/renderer/pane-dividers'

function setup() {
  const host = document.createElement('section')
  host.getBoundingClientRect = () => ({ left: 0, width: 1000 + PANE_DIVIDER_PX }) as DOMRect
  const committed: number[][] = []
  const layout = createPaneLayout({ host, minPanePx: 200, onWidthsCommitted: (widths) => committed.push(widths) })
  const pane = (name: string) => {
    const element = document.createElement('div')
    element.dataset.name = name
    return element
  }
  const childNames = () => [...host.children].map((child) => (child as HTMLElement).dataset.name ?? 'divider')
  return { host, layout, committed, pane, childNames }
}

describe('칸 배치', () => {
  it('칸 사이마다 세로 막대를 하나씩 둔다', () => {
    const { layout, pane, childNames } = setup()
    layout.render([pane('a'), pane('b'), pane('c')], [0.2, 0.3, 0.5])
    expect(childNames()).toEqual(['a', 'divider', 'b', 'divider', 'c'])
  })

  it('칸이 하나면 막대가 없다', () => {
    const { layout, pane, childNames } = setup()
    const a = pane('a')
    layout.render([a, pane('b')], [0.5, 0.5])
    layout.render([a], [1])
    expect(childNames()).toEqual(['a'])
  })

  it('칸 너비 비율대로 열 너비를 정한다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.3, 0.7])
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.3fr) ${PANE_DIVIDER_PX}px minmax(0, 0.7fr)`)
  })

  it('칸을 빼도 남아 있는 칸 요소는 떼었다 붙이지 않는다', () => {
    const { host, layout, pane } = setup()
    const a = pane('a')
    const b = pane('b')
    layout.render([a, b], [0.5, 0.5])
    const observer = new MutationObserver(() => undefined)
    observer.observe(host, { childList: true })
    a.remove()
    layout.render([b], [1])
    const removed = observer.takeRecords().flatMap((record) => [...record.removedNodes])
    expect(removed).not.toContain(b)
    expect(host.children[0]).toBe(b)
  })

  it('칸 막대는 세로 구분선으로 알린다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    expect(divider.className).toBe('pane-divider')
    expect(divider.getAttribute('role')).toBe('separator')
    expect(divider.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('막대를 끌면 양옆 칸 너비가 바뀌고 놓으면 바뀐 비율을 알린다', () => {
    const { host, layout, pane, committed } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 + PANE_DIVIDER_PX / 2 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.3fr) ${PANE_DIVIDER_PX}px minmax(0, 0.7fr)`)
    divider.dispatchEvent(new MouseEvent('pointerup', { clientX: 300 }))
    expect(committed).toEqual([[0.3, 0.7]])
  })

  it('막대를 끌어도 칸은 최소 너비보다 좁아지지 않는다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.2fr) ${PANE_DIVIDER_PX}px minmax(0, 0.8fr)`)
  })

  it('놓은 뒤에는 움직여도 너비가 바뀌지 않는다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointerup', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.5fr) ${PANE_DIVIDER_PX}px minmax(0, 0.5fr)`)
  })

  it('창 너비를 알려 준다', () => {
    expect(setup().layout.hostWidth()).toBe(1000 + PANE_DIVIDER_PX)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/renderer/pane-dividers.test.ts`
Expected: FAIL (`pane-dividers` 모듈 없음)

- [ ] **Step 3: 구현**

`src/renderer/pane-dividers.ts`:

```ts
import { widthsAfterDrag } from './pane-widths'

export const PANE_DIVIDER_PX = 6

export type PaneLayout = {
  render(paneElements: readonly HTMLElement[], widths: readonly number[]): void
  hostWidth(): number
}

export type PaneLayoutOptions = {
  host: HTMLElement
  minPanePx: number
  onWidthsCommitted(widths: number[]): void
}

export function createPaneLayout({ host, minPanePx, onWidthsCommitted }: PaneLayoutOptions): PaneLayout {
  const doc = host.ownerDocument
  const dividers: HTMLElement[] = []
  let widths: number[] = []

  function applyWidths(): void {
    host.style.gridTemplateColumns = widths.map((width) => `minmax(0, ${width}fr)`).join(` ${PANE_DIVIDER_PX}px `)
  }

  function paneAreaWidth(): number {
    return host.getBoundingClientRect().width - PANE_DIVIDER_PX * (widths.length - 1)
  }

  function createDivider(index: number): HTMLElement {
    const divider = doc.createElement('div')
    divider.className = 'pane-divider'
    divider.setAttribute('role', 'separator')
    divider.setAttribute('aria-orientation', 'vertical')
    divider.addEventListener('pointerdown', (downEvent) => {
      downEvent.preventDefault()
      divider.setPointerCapture?.(downEvent.pointerId)
      const onMove = (moveEvent: PointerEvent) => {
        const available = paneAreaWidth()
        if (available <= 0) return
        // 칸 너비 비율은 막대를 뺀 너비 기준이므로, 이 막대 앞에 있는 막대들과 막대 자신의 절반을 뺀다.
        const pointerPx =
          moveEvent.clientX - host.getBoundingClientRect().left - PANE_DIVIDER_PX * index - PANE_DIVIDER_PX / 2
        widths = widthsAfterDrag(widths, index, pointerPx / available, minPanePx / available)
        applyWidths()
      }
      const onUp = () => {
        divider.removeEventListener('pointermove', onMove)
        divider.removeEventListener('pointerup', onUp)
        onWidthsCommitted([...widths])
      }
      divider.addEventListener('pointermove', onMove)
      divider.addEventListener('pointerup', onUp)
    })
    return divider
  }

  return {
    render(paneElements, nextWidths) {
      widths = [...nextWidths]
      while (dividers.length < paneElements.length - 1) dividers.push(createDivider(dividers.length))
      const ordered = paneElements.flatMap((element, index) => (index === 0 ? [element] : [dividers[index - 1], element]))
      // 에디터를 떼었다 붙이면 커서와 스크롤 위치를 잃으므로, 빠진 요소만 지우고 새 요소만 끼워 넣는다.
      for (const child of [...host.children]) {
        if (!ordered.includes(child as HTMLElement)) child.remove()
      }
      ordered.forEach((element, index) => {
        if (host.children[index] !== element) host.insertBefore(element, host.children[index] ?? null)
      })
      applyWidths()
    },
    hostWidth: () => host.getBoundingClientRect().width,
  }
}
```

- [ ] **Step 4: CSS**

`src/renderer/styles.css`의 `/* 에디터 */` 아래 `#editor { ... }` 규칙을 아래로 바꾸고, 바로 뒤에 칸과 막대 규칙을 더한다:

```css
/* 에디터: 나란히 놓인 글 칸 */
#editor {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.editor-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-divider {
  cursor: col-resize;
  touch-action: none;
  background: var(--color-background);
  border-left: 1px solid var(--color-divider);
  border-right: 1px solid var(--color-divider);
}

.pane-divider:hover {
  background: var(--color-divider);
}
```

(`#editor .cm-editor { height: 100%; ... }` 같은 기존 `#editor .cm-…` 규칙은 그대로 둔다. 칸은 `#editor` 안에 있으므로 그대로 적용된다.)

- [ ] **Step 5: 통과 확인**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/renderer/pane-dividers.ts src/renderer/styles.css tests/renderer/pane-dividers.test.ts
git commit -m "feat: 칸 배치와 칸 사이 세로 막대" -m "#editor 안에 칸과 막대를 가로 격자로 놓고, 막대를 끌면 양옆 칸 너비만 바꾼다. 칸을 더하거나 빼도 남은 에디터는 떼었다 붙이지 않아 커서와 스크롤을 잃지 않는다."
```

---

### Task 11: 앱에 연결하고 직접 확인 (`app.ts`)

**Files:**
- Modify: `src/renderer/app.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 2~10의 모든 모듈
- Produces: 없음 (조립)

- [ ] **Step 1: `src/renderer/app.ts` 전체를 아래로 바꾼다**

```ts
import type { ImworkingApi } from '../shared/api'
import { MAX_PANES } from '../shared/panes'
import { FONT_SIZE_RANGE } from '../shared/settings'
import type { Settings, ThemeId } from '../shared/types'
import { backupSetOf, createAutosave, unsavedPaneCount } from './autosave'
import { createCloseHandler } from './close-handler'
import { createCommandLock } from './command-lock'
import { createDebouncedTask } from './debounce'
import { createDocumentCommands, type CommandsApi } from './document-commands'
import { createDocumentPane, type DocumentPane } from './document-pane'
import { createDocumentState } from './document-state'
import { createEditor } from './editor'
import { createLogView } from './fake/log-view'
import { installFileDrop } from './file-drop'
import { createTypingActivity, delayMultiplier, withIdleThinking } from './fake/pacing'
import { createPlayer } from './fake/player'
import { createSessionStream } from './fake/scenario'
import { PANE_DIVIDER_PX, createPaneLayout } from './pane-dividers'
import { createPaneSet, type PaneChange } from './pane-set'
import { MIN_PANE_WIDTH_PX, canAddPane, equalWidths, widthsAfterAdd, widthsAfterRemove } from './pane-widths'
import { createSettingsDialog } from './settings-dialog'
import { APP_SHORTCUTS, bindShortcuts } from './shortcuts'
import { createPanicToggle } from './split-layout'
import { createSplitter } from './splitter'
import { UNTITLED_NAME, createStatusbar } from './statusbar'
import { createSessionHider, windowTitleFor } from './stealth'
import { THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from './themes'
import { createTitlebar } from './titlebar'
import { createWorkspaceCommands } from './workspace-commands'

export async function startApp(api: ImworkingApi, doc: Document): Promise<void> {
  const elementById = (id: string): HTMLElement => {
    const element = doc.getElementById(id)
    if (!element) throw new Error(`#${id} is missing in index.html`)
    return element
  }

  let settings = await api.loadSettings()
  const startupOpenFiles = settings.openFiles
  const startupPaneWidths = settings.paneWidths
  let startupFinished = false

  const titlebar = createTitlebar(elementById('titlebar'), {
    platform: api.platform,
    actions: {
      minimize: () => api.minimizeWindow(),
      toggleMaximize: () => api.toggleMaximizeWindow(),
      close: () => api.requestCloseWindow(),
    },
  })
  const statusbar = createStatusbar(elementById('statusbar'))

  const typingActivity = createTypingActivity(() => Date.now())
  const sessionStream = createSessionStream(Date.now(), (project) => renderPrompt(getTheme(settings.theme), project))
  const player = createPlayer({
    nextEvent: withIdleThinking(sessionStream, () => settings.typingLink && typingActivity.state() === 'idle'),
    sink: createLogView(elementById('log')),
    delayMultiplier: () =>
      delayMultiplier({ speed: settings.logSpeed, typingLink: settings.typingLink, typingState: typingActivity.state() }),
  })

  function refreshStatus(): void {
    statusbar.update({ ...panes.focused().status(), logPaused: settings.stealthMode && player.isPaused() })
    refreshWindowTitle()
  }

  let renderedTitlebar = ''
  function refreshWindowTitle(): void {
    const theme = getTheme(settings.theme)
    const { fileName, dirty } = panes.focused().status()
    const title = windowTitleFor({
      stealthMode: settings.stealthMode,
      disguisedTitle: theme.windowTitle,
      documentName: fileName ?? UNTITLED_NAME,
      dirty,
    })
    doc.title = title
    const titlebarKey = `${theme.titlebarStyle}|${title}`
    if (titlebarKey === renderedTitlebar) return
    renderedTitlebar = titlebarKey
    titlebar.render(theme.titlebarStyle, title)
  }

  const commandLock = createCommandLock()
  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path, options) => api.openPath(path, options),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
  }
  const paneParts = { createEditor, createDocumentState, createDocumentCommands, createDebouncedTask }

  function openFilePaths(): string[] {
    return panes.all().flatMap((pane) => {
      const path = pane.filePath()
      return path ? [path] : []
    })
  }

  function createPane(): DocumentPane {
    const pane: DocumentPane = createDocumentPane({
      doc,
      parts: paneParts,
      defaultEol: api.defaultEol,
      display: {
        syntaxHighlight: settings.syntaxHighlight,
        fontSize: settings.fontSize,
        // 터미널에는 줄 번호가 없으므로 은신 모드에서는 숨긴다.
        lineNumbersVisible: !settings.stealthMode,
      },
      api: commandsApi,
      lock: commandLock,
      savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
      focusIfOpenElsewhere: (path) => workspace.focusPaneWithFile(path, pane),
      onFileLocationChanged: (location) => {
        const patch: Partial<Settings> = { openFiles: openFilePaths() }
        if (location) patch.lastDirectory = location.directory
        if (location?.origin === 'saved') patch.defaultFormat = location.format
        updateSettings(patch)
      },
      onBackupStale: () => void autosave.flushNow(),
      onStatusChanged: () => {
        if (panes.focused() === pane) refreshStatus()
      },
      onUserTyped: () => typingActivity.markTyped(),
      onFocused: () => panes.focus(pane),
    })
    return pane
  }

  let paneWidths = [1]
  const paneLayout = createPaneLayout({
    host: elementById('editor'),
    minPanePx: MIN_PANE_WIDTH_PX,
    onWidthsCommitted: (widths) => {
      paneWidths = widths
      updateSettings({ paneWidths })
    },
  })

  function paneAreaWidth(paneCount: number): number {
    return paneLayout.hostWidth() - PANE_DIVIDER_PX * (paneCount - 1)
  }

  function renderPanes(): void {
    paneLayout.render(
      panes.all().map((pane) => pane.element),
      paneWidths,
    )
  }

  function onPanesChanged(change: PaneChange): void {
    if (change.kind === 'added') {
      const area = paneAreaWidth(panes.all().length)
      paneWidths = widthsAfterAdd(paneWidths, change.index - 1, area > 0 ? MIN_PANE_WIDTH_PX / area : 1)
    }
    if (change.kind === 'removed') paneWidths = widthsAfterRemove(paneWidths, change.index)
    if (change.kind !== 'focused') {
      renderPanes()
      if (startupFinished) updateSettings({ openFiles: openFilePaths(), paneWidths })
    }
    refreshStatus()
  }

  const panes = createPaneSet<DocumentPane>({
    maxPanes: MAX_PANES,
    createPane,
    destroyPane: (pane) => pane.destroy(),
    onChanged: onPanesChanged,
  })
  renderPanes()

  const workspace = createWorkspaceCommands({
    panes,
    maxPanes: MAX_PANES,
    onBackupStale: () => void autosave.flushNow(),
    clearBackup: () => api.clearBackup(),
    closeWindowNow: () => api.closeWindowNow(),
  })

  function forEachPane(apply: (pane: DocumentPane) => void): void {
    for (const pane of panes.all()) apply(pane)
  }

  const sessionHider = createSessionHider(player)
  const panic = createPanicToggle()
  const splitter = createSplitter({
    container: elementById('workspace'),
    handle: elementById('split-handle'),
    initialRatio: settings.splitRatio,
    onRatioCommitted: (ratio) => {
      if (!panic.isPanicked()) updateSettings({ splitRatio: ratio })
    },
  })

  function applyTheme(themeId: ThemeId): void {
    const theme = getTheme(themeId)
    for (const [name, value] of Object.entries(themeCssVariables(theme))) {
      doc.documentElement.style.setProperty(name, value)
    }
    refreshWindowTitle()
  }

  function applyStealthMode(): void {
    elementById('workspace').classList.toggle('session-hidden', !settings.stealthMode)
    // 터미널에는 줄 번호가 없으므로 은신 모드에서는 숨긴다.
    forEachPane((pane) => pane.setLineNumbersVisible(!settings.stealthMode))
    if (settings.stealthMode) {
      sessionHider.show()
    } else {
      if (panic.isPanicked()) splitter.setRatio(panic.toggle(splitter.getRatio()))
      sessionHider.hide()
    }
    refreshStatus()
  }

  function applySettings(previous: Settings | null): void {
    if (!previous || previous.theme !== settings.theme) applyTheme(settings.theme)
    if (!previous || previous.stealthMode !== settings.stealthMode) applyStealthMode()
    if (previous && previous.syntaxHighlight !== settings.syntaxHighlight) {
      forEachPane((pane) => pane.setSyntaxHighlight(settings.syntaxHighlight))
    }
    if (previous && previous.fontSize !== settings.fontSize) {
      forEachPane((pane) => pane.setFontSize(settings.fontSize))
    }
  }

  function updateSettings(patch: Partial<Settings>): void {
    const previous = settings
    settings = { ...settings, ...patch }
    applySettings(previous)
    void api.saveSettings(settings)
  }

  function changeFontSize(step: number): void {
    const next = Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, settings.fontSize + step))
    if (next !== settings.fontSize) updateSettings({ fontSize: next })
  }

  function togglePanic(): void {
    splitter.setRatio(panic.toggle(splitter.getRatio()))
    if (panic.isPanicked()) {
      settingsDialog.close()
      ;(doc.activeElement as HTMLElement | null)?.blur()
    } else {
      panes.focused().focus()
    }
  }

  function toggleLogPause(): void {
    if (player.isPaused()) player.resume()
    else player.pause()
    refreshStatus()
  }

  function addPane(): void {
    const count = panes.all().length
    if (!canAddPane(count, paneAreaWidth(count + 1), MIN_PANE_WIDTH_PX)) return
    workspace.addPane()
  }

  function focusNextPane(): void {
    panes.focusNext()
    panes.focused().focus()
  }

  const settingsDialog = createSettingsDialog({
    host: elementById('dialog-host'),
    platform: api.platform,
    themes: Object.values(THEMES).map(({ id, name }) => ({ id, name })),
    onChange: (patch) => updateSettings(patch),
  })

  const autosave = createAutosave({
    takeSnapshot: () => backupSetOf(panes.all().map((pane) => pane.snapshot()), new Date().toISOString()),
    writeBackup: (backup) => api.writeBackup(backup),
    clearBackup: () => api.clearBackup(),
  })

  const focusedCommands = () => panes.focused().commands

  bindShortcuts(
    doc.defaultView ?? window,
    [
      { combo: () => APP_SHORTCUTS.newDocument, run: () => void focusedCommands().newDocument() },
      { combo: () => APP_SHORTCUTS.open, run: () => void focusedCommands().open() },
      { combo: () => APP_SHORTCUTS.save, run: () => void focusedCommands().save() },
      { combo: () => APP_SHORTCUTS.saveAs, run: () => void focusedCommands().saveAs() },
      { combo: () => APP_SHORTCUTS.addPane, run: addPane },
      { combo: () => APP_SHORTCUTS.closePane, run: () => void workspace.closeFocusedPane() },
      { combo: () => APP_SHORTCUTS.nextPane, run: focusNextPane },
      {
        combo: () => APP_SHORTCUTS.openSettings,
        run: () => (settingsDialog.isOpen() ? settingsDialog.close() : settingsDialog.open(settings)),
      },
      {
        combo: () => APP_SHORTCUTS.toggleSyntaxHighlight,
        run: () => updateSettings({ syntaxHighlight: !settings.syntaxHighlight }),
      },
      { combo: () => (settings.stealthMode ? APP_SHORTCUTS.toggleLogPause : null), run: toggleLogPause },
      { combo: () => APP_SHORTCUTS.cycleTheme, run: () => updateSettings({ theme: nextThemeId(settings.theme) }) },
      {
        combo: () => APP_SHORTCUTS.toggleStealthMode,
        run: () => updateSettings({ stealthMode: !settings.stealthMode }),
      },
      { combo: () => APP_SHORTCUTS.increaseFontSize, run: () => changeFontSize(1) },
      { combo: () => APP_SHORTCUTS.decreaseFontSize, run: () => changeFontSize(-1) },
      // 은신 모드를 끄면 숨길 가짜 화면이 없으므로 패닉 키도 쓰지 않는다.
      { combo: () => (settings.stealthMode && settings.panicEnabled ? settings.panicKey : null), run: togglePanic },
    ],
    api.platform,
  )

  doc.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      changeFontSize(event.deltaY < 0 ? 1 : -1)
    },
    { passive: false },
  )

  api.onCloseRequested(
    createCloseHandler({
      isStartupFinished: () => startupFinished,
      closeWindow: () => workspace.closeWindow(),
      closeWindowNow: () => api.closeWindowNow(),
      pauseAutosave: () => autosave.stop(),
      resumeAutosave: () => autosave.start(),
    }),
  )
  installFileDrop(doc, {
    pathForFile: (file) => api.pathForFile(file),
    onFileDropped: (path, dropTarget) => {
      const target = panes.all().find((pane) => dropTarget instanceof Node && pane.element.contains(dropTarget))
      void workspace.openRequestedFile(path, target)
    },
  })

  applySettings(null)
  refreshStatus()
  player.start()

  const backup = await api.readBackup()
  const unsavedCount = backup ? unsavedPaneCount(backup) : 0
  const restored = backup !== null && unsavedCount > 0 && (await api.askRestoreBackup(backup.savedAt, unsavedCount))
  if (backup && restored) await workspace.restore(backup)
  else if (backup) await api.clearBackup()

  // main은 대기 중인 파일을 넘겨준 뒤부터 요청을 바로 보내므로, 그보다 먼저 받을 준비를 해야 요청이 사라지지 않는다.
  api.onFileOpenRequested((path) => void workspace.openRequestedFile(path))
  const requestedFile = await api.takeRequestedFile()
  if (requestedFile) await workspace.openRequestedFile(requestedFile)
  else if (!restored) await workspace.reopen(startupOpenFiles)

  const paneCount = panes.all().length
  paneWidths = startupPaneWidths.length === paneCount ? [...startupPaneWidths] : equalWidths(paneCount)
  renderPanes()
  startupFinished = true
  updateSettings({ openFiles: openFilePaths(), paneWidths })

  autosave.start()
  panes.focused().focus()
}
```

- [ ] **Step 2: 자동 검사**

Run: `npm test && npm run typecheck`
Expected: 모든 테스트 PASS, 타입 오류 없음

- [ ] **Step 3: 앱을 직접 띄워 확인 (격리된 사용자 데이터)**

사용자가 쓰는 앱을 끄지 않는다. 확인용 실행은 사용자 데이터 폴더를 따로 써서 사용자의 설정·백업을 건드리지 않는다.

```bash
export PATH="/c/Program Files/nodejs:$PATH"
SCR="<scratchpad 폴더>"
npx electron-vite build
./node_modules/electron/dist/electron.exe . --remote-debugging-port=9222 --user-data-dir="$SCR/userdata" &
```

CDP로 화면을 조작하는 도구가 없으면 `$SCR/cdp.mjs`를 만든다 (JSON 배열의 `[method, params]`를 차례로 보내고, `["sleep", ms]`는 기다리고, 스크린샷은 두 번째 인자 경로에 저장):

```js
const [targets] = [await (await fetch('http://127.0.0.1:9222/json/list')).json()]
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (pending.has(msg.id)) pending.get(msg.id)(msg)
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const myId = ++id
    pending.set(myId, resolve)
    ws.send(JSON.stringify({ id: myId, method, params }))
  })
for (const [method, params] of JSON.parse(process.argv[2])) {
  if (method === 'sleep') { await new Promise((r) => setTimeout(r, params)); continue }
  const res = await send(method, params)
  if (method === 'Runtime.evaluate') console.log(JSON.stringify(res.result?.result?.value ?? res.result ?? res.error))
  else if (method === 'Page.captureScreenshot') { (await import('node:fs')).writeFileSync(process.argv[3], Buffer.from(res.result.data, 'base64')); console.log('shot') }
  else if (res.error) console.log(JSON.stringify(res.error))
}
ws.close()
```

키 입력은 `Input.dispatchKeyEvent`(예: `Ctrl+\`는 `{"type":"keyDown","modifiers":2,"code":"Backslash","key":"\\","windowsVirtualKeyCode":220}`), 각 칸의 에디터는 `document.querySelectorAll('.editor-pane .cm-content')[i].cmTile.view`로 잡는다.

확인할 것 (스크린샷으로 남긴다):

1. `Ctrl+\` → 칸 두 개, 세로 막대 하나, 커서는 오른쪽 칸. 은신 모드에서 위쪽 가짜 세션은 전체 너비 그대로이고 줄번호가 두 칸 모두 없다.
2. 다시 `Ctrl+\` → 칸 수 그대로 2.
3. 오른쪽 칸에 글을 쓰고 `Ctrl+Tab` → 왼쪽 칸으로 커서, 상태바 파일 이름이 바뀐다. 다시 `Ctrl+Tab` → 오른쪽.
4. 막대를 `Input.dispatchMouseEvent`로 끌기 → 너비가 바뀌고, `settings.json`의 `paneWidths`가 바뀐다.
5. `Ctrl+Shift+M`으로 은신 모드 끄기 → 가짜 세션이 사라지고 두 칸이 화면을 채우며 두 칸 모두 줄번호가 보인다. 창 제목이 지금 칸 문서를 따른다.
6. 두 칸에 쓴 상태에서 30초 넘게 기다린 뒤 `taskkill //F //IM electron.exe`로 강제 종료 → `$SCR/userdata/backup/current.json`에 칸 두 개가 들어 있다. 다시 실행하면 "저장되지 않은 글이 2개 있습니다" 질문이 뜬다 (대화상자는 직접 볼 수 없으면 `current.json` 내용과 질문 전 상태까지만 확인하고, 복구 흐름은 사용자 확인 항목으로 남긴다).
7. 오른쪽 칸에서 `Ctrl+W` (변경 없을 때) → 칸 하나로 돌아가고 너비가 전체로 돌아온다.

끝나면 `taskkill //F //IM electron.exe`로 확인용 앱만 끄고 `$SCR/userdata`를 지운다. 사용자가 띄워 둔 패키지 앱(`dist/win-unpacked/imworkinghh.exe`)이 같은 이름이면 끄기 전에 사용자에게 앱을 닫아 달라고 먼저 부탁한다.

- [ ] **Step 4: 커밋**

```bash
git add src/renderer/app.ts
git commit -m "feat: 나란히 쓰기를 앱에 연결" -m "칸 목록, 칸 하나, 여러 칸 흐름, 칸 배치를 app에서 조립한다. 단축키와 저장 명령은 지금 칸에 적용하고, 끌어다 놓은 파일은 놓은 칸에 연다. 상태바와 창 제목은 지금 칸을 따르고, 시작할 때 백업 복구, 다른 프로그램에서 연 파일, 지난 파일 목록 순서로 칸을 연다."
```

---

## 사용자 확인 항목 (자동 검사로 볼 수 없는 것)

구현이 끝나면 사용자에게 아래를 직접 확인해 달라고 부탁한다:

- 파일을 오른쪽 칸에 끌어다 놓으면 오른쪽 칸에 열린다.
- 두 칸 모두 저장 안 한 상태에서 창을 닫으면 왼쪽 칸부터 차례로 묻고, 둘째 칸에서 취소하면 창이 닫히지 않는다.
- 강제 종료 뒤 다시 실행하면 "저장되지 않은 글이 2개 있습니다"가 뜨고, 복구하면 두 칸이 그대로 돌아온다.
- 한글 입력 중 `Ctrl+\`, `Ctrl+Tab`이 글자를 깨뜨리지 않는다.
