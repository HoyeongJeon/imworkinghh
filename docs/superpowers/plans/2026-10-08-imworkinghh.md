# imworkinghh 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위쪽에는 가짜 Claude Code 세션이 흐르고 아래쪽에서 실제로 마크다운/텍스트 글을 쓰는, 터미널처럼 보이는 Windows/macOS 데스크톱 앱을 만든다.

**Architecture:** Electron 앱이다. 디스크 접근(파일, 설정, 백업)은 main 프로세스가 맡고, renderer는 preload가 노출한 `ImworkingApi`만 쓴다. 계산과 판단은 DOM/Electron과 분리된 순수 함수 모듈로 만들고, 의존 대상(DOM 요소, 타이머, 시계, 파일 시스템, API)은 인자로 받는다. 모듈 연결은 `src/main/index.ts`와 `src/renderer/app.ts`에서만 한다.

**Tech Stack:** Electron, TypeScript (UI 프레임워크 없음), CodeMirror 6, electron-vite, electron-builder, Vitest (+ jsdom)

**Spec:** `docs/superpowers/specs/2026-10-08-imworkinghh-design.md`
**규칙:** `CLAUDE.md` (예시는 `docs/conventions.md`) / **결정:** `DECISIONLOG.md`

## Global Constraints

모든 Task는 [`CLAUDE.md`](../../../CLAUDE.md)의 **개발 규칙**과 **제품 기준값**을 따른다. 규칙의 원본은 CLAUDE.md 하나이고, 여기에 다시 적지 않는다.

## Review Focus

스펙이 직접 말하지 않지만 실제 사용에서 문제가 되기 쉬운 상황이다. 각 항목의 테스트는 해당 Task에 들어 있다.

1. 한글 조합(IME) 중에 단축키 조합이 눌려도 단축키가 실행되면 안 된다 → Task 16 `한글 조합 중에는 단축키가 반응하지 않는다`
2. 사용자 폴더 이름이 한글(`C:\Users\홍길동`)이고 파일명에 공백이 있어도 저장되어야 한다 → Task 4 `한글과 공백이 들어간 경로에도 저장한다`
3. 창을 닫다가 "저장"을 골랐는데 저장 창을 취소하면 창이 닫히면 안 된다 (글 손실) → Task 15 `닫을 때 저장을 골랐는데 저장 창을 취소하면 닫지 않는다`
4. 모니터를 뺀 뒤 실행하면 창이 화면 밖에 뜨면 안 된다 → Task 8 `모니터를 빼서 저장된 위치가 어느 화면에도 없으면 쓰지 않는다`
5. CRLF와 LF가 섞인 파일은 많이 쓰인 쪽으로 저장해야 한다 → Task 2 `줄바꿈이 섞여 있으면 더 많이 쓰인 방식을 따른다`

## 파일 구조

스펙 10장의 모듈 구조를 그대로 따른다. 테스트는 `tests/` 아래 같은 경로에 둔다.

| Task | 만드는 파일 |
|---|---|
| 1 | `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `vitest.config.ts`, `src/shared/types.ts`, `src/shared/settings.ts`, 최소 `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.ts` |
| 2 | `src/shared/eol.ts`, `src/main/text-codec.ts` |
| 3 | `src/main/file-format.ts`, `src/main/fs-errors.ts` |
| 4 | `src/main/atomic-write.ts` |
| 5 | `src/main/documents.ts` |
| 6 | `src/main/settings-store.ts`, `src/main/backup-store.ts` |
| 7 | `src/shared/api.ts`, `src/main/file-service.ts` |
| 8 | `src/shared/ipc-channels.ts`, `src/main/window-bounds.ts`, `src/main/window.ts`, `src/main/dialogs.ts`, `src/main/close-guard.ts`, `src/main/ipc.ts`, `src/main/menu.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/env.d.ts` |
| 9 | `src/renderer/themes.ts` |
| 10 | `src/renderer/fake/events.ts`, `rng.ts`, `pools.ts`, `scenario.ts` |
| 11 | `src/renderer/fake/pacing.ts` |
| 12 | `src/renderer/fake/player.ts`, `src/renderer/fake/log-view.ts` |
| 13 | `src/renderer/split-layout.ts`, `src/renderer/splitter.ts` |
| 14 | `src/renderer/editor.ts`, `tests/setup-dom.ts` |
| 15 | `src/renderer/document-state.ts`, `src/renderer/document-commands.ts`, `src/renderer/autosave.ts` |
| 16 | `src/renderer/shortcuts.ts`, `src/renderer/statusbar.ts`, `src/renderer/titlebar.ts` |
| 17 | `src/renderer/settings-dialog.ts` |
| 18 | `src/renderer/app.ts`, `src/renderer/styles.css`, `src/renderer/index.html`, `src/renderer/main.ts` |
| 19 | `electron-builder.yml`, `docs/build.md`, `CLAUDE.md` 갱신 |

---

### Task 1: 프로젝트 뼈대와 설정 기본값/교정

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `vitest.config.ts`
- Create: `src/shared/types.ts`, `src/shared/settings.ts`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.ts` (최소 버전, Task 8과 18에서 교체)
- Test: `tests/shared/settings.test.ts`

**Interfaces:**
- Produces:
  - `src/shared/types.ts`: `THEME_IDS`, `ThemeId`, `LOG_SPEEDS`, `LogSpeed`, `FILE_FORMATS`, `FileFormat`, `Eol`, `SourceEncoding`, `WindowBounds`, `Settings`, `Backup`
  - `src/shared/settings.ts`: `defaultSettings(platform: string): Settings`, `normalizeSettings(raw: unknown, platform: string): Settings`, `FONT_SIZE_RANGE`, `SPLIT_RATIO_RANGE`

- [ ] **Step 1: 작업 브랜치 만들기**

```bash
cd /c/dev/imworkinghh && git switch -c feat/app
```

- [ ] **Step 2: Node.js 확인과 설치**

PowerShell:
```powershell
node --version
```
명령을 찾을 수 없으면 설치하고 현재 셸의 PATH를 새로 읽는다:
```powershell
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
node --version; npm --version
```
Expected: `v22.x` 이상, npm 버전 출력.

- [ ] **Step 3: `package.json` 작성**

```json
{
  "name": "imworkinghh",
  "version": "0.1.0",
  "private": true,
  "description": "Terminal-looking markdown writer",
  "author": "hoyeongjeon",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "dist:win": "electron-vite build && electron-builder --win dir",
    "dist:mac": "electron-vite build && electron-builder --mac dmg"
  }
}
```

- [ ] **Step 4: 패키지 설치**

```bash
cd /c/dev/imworkinghh && npm install -D electron electron-vite electron-builder vite typescript vitest jsdom @types/node codemirror @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lang-markdown @codemirror/language-data @lezer/highlight
```
Expected: `package-lock.json` 생성, 오류 없음.

- [ ] **Step 5: 설정 파일 작성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests", "electron.vite.config.ts", "vitest.config.ts"]
}
```

`electron.vite.config.ts` (기본 진입점 `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`을 그대로 쓴다):
```ts
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {},
})
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: 기본 타입 작성**

`src/shared/types.ts`:
```ts
export const THEME_IDS = [
  'windows-terminal',
  'powershell',
  'cmd',
  'wsl-ubuntu',
  'macos-basic',
  'macos-homebrew',
] as const
export type ThemeId = (typeof THEME_IDS)[number]

export const LOG_SPEEDS = ['slow', 'normal', 'fast'] as const
export type LogSpeed = (typeof LOG_SPEEDS)[number]

export const FILE_FORMATS = ['md', 'txt'] as const
export type FileFormat = (typeof FILE_FORMATS)[number]

export type Eol = 'lf' | 'crlf'

export type SourceEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'cp949'

export type WindowBounds = { x: number; y: number; width: number; height: number }

export type Settings = {
  theme: ThemeId
  syntaxHighlight: boolean
  panicEnabled: boolean
  panicKey: string
  typingLink: boolean
  logSpeed: LogSpeed
  fontSize: number
  splitRatio: number
  windowBounds: WindowBounds | null
  lastDirectory: string | null
  lastFile: string | null
  defaultFormat: FileFormat
}

export type Backup = {
  path: string | null
  content: string
  eol: Eol
  savedAt: string
}
```

- [ ] **Step 7: 실패하는 테스트 작성**

`tests/shared/settings.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { defaultSettings, normalizeSettings } from '../../src/shared/settings'

describe('설정 기본값', () => {
  it('윈도우에서는 Windows Terminal 테마와 Ctrl+` 패닉 키로 시작한다', () => {
    const settings = defaultSettings('win32')
    expect(settings.theme).toBe('windows-terminal')
    expect(settings.panicKey).toBe('Mod+`')
  })

  it('맥에서는 macOS Basic 테마와 Cmd+Shift+. 패닉 키로 시작한다', () => {
    const settings = defaultSettings('darwin')
    expect(settings.theme).toBe('macos-basic')
    expect(settings.panicKey).toBe('Mod+Shift+.')
  })

  it('문법 색칠, 패닉 키, 타이핑 연동은 켜진 상태로 시작한다', () => {
    const settings = defaultSettings('win32')
    expect(settings.syntaxHighlight).toBe(true)
    expect(settings.panicEnabled).toBe(true)
    expect(settings.typingLink).toBe(true)
  })
})

describe('설정 교정', () => {
  it('저장된 값이 없으면 기본값을 쓴다', () => {
    expect(normalizeSettings(undefined, 'win32')).toEqual(defaultSettings('win32'))
  })

  it('올바른 값은 그대로 유지한다', () => {
    const saved = {
      ...defaultSettings('win32'),
      theme: 'wsl-ubuntu',
      logSpeed: 'fast',
      lastFile: 'C:\\notes\\회의록.md',
      windowBounds: { x: 10, y: 20, width: 800, height: 600 },
    }
    expect(normalizeSettings(saved, 'win32')).toEqual(saved)
  })

  it('알 수 없는 항목은 버린다', () => {
    expect(normalizeSettings({ unknownOption: 1 }, 'win32')).not.toHaveProperty('unknownOption')
  })

  it('타입이 틀린 값은 기본값으로 바꾼다', () => {
    const result = normalizeSettings(
      { syntaxHighlight: 'yes', fontSize: '20', windowBounds: { x: 0 } },
      'win32',
    )
    expect(result.syntaxHighlight).toBe(true)
    expect(result.fontSize).toBe(14)
    expect(result.windowBounds).toBeNull()
  })

  it('글꼴 크기와 분할 비율은 허용 범위 안으로 맞춘다', () => {
    const result = normalizeSettings({ fontSize: 99, splitRatio: -1 }, 'win32')
    expect(result.fontSize).toBe(32)
    expect(result.splitRatio).toBe(0.1)
  })

  it('없는 테마 이름이면 기본 테마로 바꾼다', () => {
    expect(normalizeSettings({ theme: 'solarized' }, 'darwin').theme).toBe('macos-basic')
  })
})
```

- [ ] **Step 8: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/shared/settings.test.ts`
Expected: FAIL, `Failed to resolve import "../../src/shared/settings"`

- [ ] **Step 9: 구현**

`src/shared/settings.ts`:
```ts
import { FILE_FORMATS, LOG_SPEEDS, THEME_IDS, type Settings, type WindowBounds } from './types'

export const FONT_SIZE_RANGE = { min: 10, max: 32 }
export const SPLIT_RATIO_RANGE = { min: 0.1, max: 0.9 }

export function defaultSettings(platform: string): Settings {
  const isMac = platform === 'darwin'
  return {
    theme: isMac ? 'macos-basic' : 'windows-terminal',
    syntaxHighlight: true,
    panicEnabled: true,
    panicKey: isMac ? 'Mod+Shift+.' : 'Mod+`',
    typingLink: true,
    logSpeed: 'normal',
    fontSize: 14,
    splitRatio: 0.55,
    windowBounds: null,
    lastDirectory: null,
    lastFile: null,
    defaultFormat: 'md',
  }
}

export function normalizeSettings(raw: unknown, platform: string): Settings {
  const defaults = defaultSettings(platform)
  if (!isRecord(raw)) return defaults
  return {
    theme: pickOneOf(raw.theme, THEME_IDS, defaults.theme),
    syntaxHighlight: pickBoolean(raw.syntaxHighlight, defaults.syntaxHighlight),
    panicEnabled: pickBoolean(raw.panicEnabled, defaults.panicEnabled),
    panicKey: pickNonEmptyString(raw.panicKey) ?? defaults.panicKey,
    typingLink: pickBoolean(raw.typingLink, defaults.typingLink),
    logSpeed: pickOneOf(raw.logSpeed, LOG_SPEEDS, defaults.logSpeed),
    fontSize: pickNumberInRange(raw.fontSize, FONT_SIZE_RANGE, defaults.fontSize),
    splitRatio: pickNumberInRange(raw.splitRatio, SPLIT_RATIO_RANGE, defaults.splitRatio),
    windowBounds: pickWindowBounds(raw.windowBounds),
    lastDirectory: pickNonEmptyString(raw.lastDirectory),
    lastFile: pickNonEmptyString(raw.lastFile),
    defaultFormat: pickOneOf(raw.defaultFormat, FILE_FORMATS, defaults.defaultFormat),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pickOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function pickNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function pickNumberInRange(
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(range.max, Math.max(range.min, value))
}

function pickWindowBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  const numbers = [x, y, width, height]
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  const bounds = { x, y, width, height } as WindowBounds
  return bounds.width > 0 && bounds.height > 0 ? bounds : null
}
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `npx vitest run tests/shared/settings.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 11: 앱이 뜨는지 확인할 최소 진입점 작성**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function openWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(openWindow)
app.on('window-all-closed', () => app.quit())
```

`src/preload/index.ts`:
```ts
export {}
```

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:"
    />
    <title>imworkinghh</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/main.ts`:
```ts
document.getElementById('app')!.textContent = 'imworkinghh'
```

- [ ] **Step 12: 앱 실행과 타입 검사 확인**

Run: `npm run dev`
Expected: 창이 뜨고 `imworkinghh` 글자가 보인다. 창을 닫으면 프로세스가 끝난다.

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json electron.vite.config.ts vitest.config.ts src tests
git commit -m "feat: 프로젝트 뼈대와 설정 기본값/교정 추가

Electron + electron-vite + Vitest 구성. 설정 기본값은 OS별 테마와
패닉 키를 다르게 정하고, 저장된 설정은 타입과 범위를 교정해서 읽는다."
```

---

### Task 2: 줄바꿈 처리와 인코딩 감지

**Files:**
- Create: `src/shared/eol.ts`, `src/main/text-codec.ts`
- Test: `tests/shared/eol.test.ts`, `tests/main/text-codec.test.ts`

**Interfaces:**
- Consumes: `Eol`, `SourceEncoding` (Task 1)
- Produces:
  - `src/shared/eol.ts`: `defaultEol(platform: string): Eol`, `detectEol(text: string): Eol | null`, `normalizeToLf(text: string): string`, `applyEol(text: string, eol: Eol): string`
  - `src/main/text-codec.ts`: `type DecodedText = { text: string; encoding: SourceEncoding }`, `decodeText(bytes: Uint8Array): DecodedText`, `encodeUtf8(text: string): Uint8Array`

- [ ] **Step 1: 줄바꿈 테스트 작성**

`tests/shared/eol.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { applyEol, defaultEol, detectEol, normalizeToLf } from '../../src/shared/eol'

describe('줄바꿈 처리', () => {
  it('CRLF로 쓴 글은 CRLF로 감지한다', () => {
    expect(detectEol('첫 줄\r\n둘째 줄\r\n')).toBe('crlf')
  })

  it('LF로 쓴 글은 LF로 감지한다', () => {
    expect(detectEol('첫 줄\n둘째 줄\n')).toBe('lf')
  })

  it('줄바꿈이 없으면 감지 결과가 없다', () => {
    expect(detectEol('한 줄짜리 메모')).toBeNull()
  })

  it('줄바꿈이 섞여 있으면 더 많이 쓰인 방식을 따른다', () => {
    expect(detectEol('a\r\nb\nc\n')).toBe('lf')
    expect(detectEol('a\r\nb\r\nc\n')).toBe('crlf')
  })

  it('편집용 글은 줄바꿈을 모두 LF로 바꾼다', () => {
    expect(normalizeToLf('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
  })

  it('CRLF로 저장할 때는 모든 줄바꿈을 CRLF로 바꾼다', () => {
    expect(applyEol('a\nb\r\nc', 'crlf')).toBe('a\r\nb\r\nc')
  })

  it('LF로 저장할 때는 모든 줄바꿈을 LF로 바꾼다', () => {
    expect(applyEol('a\r\nb\nc', 'lf')).toBe('a\nb\nc')
  })

  it('새 문서의 줄바꿈은 윈도우에서 CRLF, 맥에서 LF다', () => {
    expect(defaultEol('win32')).toBe('crlf')
    expect(defaultEol('darwin')).toBe('lf')
  })
})
```

- [ ] **Step 2: 인코딩 테스트 작성**

`tests/main/text-codec.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { decodeText, encodeUtf8 } from '../../src/main/text-codec'

describe('파일 인코딩 감지', () => {
  it('일반 UTF-8 파일을 그대로 읽는다', () => {
    const bytes = new TextEncoder().encode('# 회의록')
    expect(decodeText(bytes)).toEqual({ text: '# 회의록', encoding: 'utf-8' })
  })

  it('BOM이 붙은 UTF-8 파일은 BOM을 빼고 읽는다', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('메모')])
    expect(decodeText(bytes)).toEqual({ text: '메모', encoding: 'utf-8-bom' })
  })

  it('UTF-16 LE 파일을 읽는다', () => {
    const bytes = new Uint8Array(Buffer.from('\uFEFF가나', 'utf16le'))
    expect(decodeText(bytes)).toEqual({ text: '가나', encoding: 'utf-16le' })
  })

  it('UTF-16 BE 파일을 읽는다', () => {
    const bytes = new Uint8Array(Buffer.from('\uFEFF가나', 'utf16le').swap16())
    expect(decodeText(bytes)).toEqual({ text: '가나', encoding: 'utf-16be' })
  })

  it('옛날 메모장의 CP949 한글 파일도 깨지지 않고 읽는다', () => {
    const bytes = new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb])
    expect(decodeText(bytes)).toEqual({ text: '한글', encoding: 'cp949' })
  })

  it('빈 파일은 빈 UTF-8 문서로 읽는다', () => {
    expect(decodeText(new Uint8Array())).toEqual({ text: '', encoding: 'utf-8' })
  })
})

describe('UTF-8 저장 변환', () => {
  it('저장할 글은 BOM 없는 UTF-8 바이트로 바꾼다', () => {
    expect(Array.from(encodeUtf8('한'))).toEqual([0xed, 0x95, 0x9c])
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/shared/eol.test.ts tests/main/text-codec.test.ts`
Expected: FAIL, 두 파일 모두 import를 찾지 못함

- [ ] **Step 4: 구현**

`src/shared/eol.ts`:
```ts
import type { Eol } from './types'

export function defaultEol(platform: string): Eol {
  return platform === 'win32' ? 'crlf' : 'lf'
}

export function detectEol(text: string): Eol | null {
  const crlfCount = text.match(/\r\n/g)?.length ?? 0
  const lfOnlyCount = text.match(/(?<!\r)\n/g)?.length ?? 0
  if (crlfCount === 0 && lfOnlyCount === 0) return null
  return crlfCount >= lfOnlyCount ? 'crlf' : 'lf'
}

export function normalizeToLf(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

export function applyEol(text: string, eol: Eol): string {
  const lfText = normalizeToLf(text)
  return eol === 'crlf' ? lfText.replace(/\n/g, '\r\n') : lfText
}
```

`src/main/text-codec.ts`:
```ts
import type { SourceEncoding } from '../shared/types'

export type DecodedText = { text: string; encoding: SourceEncoding }

const UTF8_BOM = [0xef, 0xbb, 0xbf]
const UTF16LE_BOM = [0xff, 0xfe]
const UTF16BE_BOM = [0xfe, 0xff]

export function decodeText(bytes: Uint8Array): DecodedText {
  if (startsWithBytes(bytes, UTF8_BOM)) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' }
  }
  if (startsWithBytes(bytes, UTF16LE_BOM)) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' }
  }
  if (startsWithBytes(bytes, UTF16BE_BOM)) {
    const littleEndian = swapByteOrder(bytes.subarray(2))
    return { text: new TextDecoder('utf-16le').decode(littleEndian), encoding: 'utf-16be' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    // 올바른 UTF-8이 아니면 한국어 Windows 메모장의 기본값이던 CP949로 본다.
    return { text: new TextDecoder('euc-kr').decode(bytes), encoding: 'cp949' }
  }
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte)
}

function swapByteOrder(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length - (bytes.length % 2))
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    swapped[i] = bytes[i + 1]
    swapped[i + 1] = bytes[i]
  }
  return swapped
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/shared/eol.test.ts tests/main/text-codec.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 6: Commit**

```bash
git add src/shared/eol.ts src/main/text-codec.ts tests/shared/eol.test.ts tests/main/text-codec.test.ts
git commit -m "feat: 줄바꿈 감지/변환과 파일 인코딩 감지 추가

UTF-8, BOM, UTF-16 LE/BE, CP949를 감지해서 읽고, 섞인 줄바꿈은 많이
쓰인 쪽을 따른다. 저장용 변환은 BOM 없는 UTF-8로 한다."
```

---

### Task 3: 파일 형식과 오류 안내

**Files:**
- Create: `src/main/file-format.ts`, `src/main/fs-errors.ts`
- Test: `tests/main/file-format.test.ts`, `tests/main/fs-errors.test.ts`

**Interfaces:**
- Consumes: `FileFormat` (Task 1)
- Produces:
  - `src/main/file-format.ts`: `formatFromPath(filePath: string): FileFormat | null`, `ensureExtension(filePath: string, format: FileFormat): string`, `type DialogFilter = { name: string; extensions: string[] }`, `saveDialogFilters(preferred: FileFormat): DialogFilter[]`, `OPEN_DIALOG_FILTERS: DialogFilter[]`
  - `src/main/fs-errors.ts`: `describeFsError(error: unknown): string`, `errorCode(error: unknown): string | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/file-format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ensureExtension, formatFromPath, saveDialogFilters } from '../../src/main/file-format'

describe('파일 저장 형식', () => {
  it('확장자 없이 저장하면 고른 형식의 확장자를 붙인다', () => {
    expect(ensureExtension('/notes/회의록', 'md')).toBe('/notes/회의록.md')
    expect(ensureExtension('/notes/회의록', 'txt')).toBe('/notes/회의록.txt')
  })

  it('이미 .md나 .txt로 끝나면 확장자를 덧붙이지 않는다', () => {
    expect(ensureExtension('/notes/a.md', 'txt')).toBe('/notes/a.md')
    expect(ensureExtension('/notes/a.txt', 'md')).toBe('/notes/a.txt')
  })

  it('확장자는 대소문자를 가리지 않는다', () => {
    expect(ensureExtension('/notes/README.MD', 'txt')).toBe('/notes/README.MD')
  })

  it('모르는 확장자면 고른 형식의 확장자를 뒤에 붙인다', () => {
    expect(ensureExtension('/notes/v1.2', 'md')).toBe('/notes/v1.2.md')
  })

  it('경로의 확장자로 형식을 알아낸다', () => {
    expect(formatFromPath('/notes/a.markdown')).toBe('md')
    expect(formatFromPath('/notes/a.TXT')).toBe('txt')
    expect(formatFromPath('/notes/a.log')).toBeNull()
  })

  it('저장 창은 마지막에 고른 형식을 먼저 보여 준다', () => {
    expect(saveDialogFilters('txt').map((f) => f.extensions[0])).toEqual(['txt', 'md'])
    expect(saveDialogFilters('md').map((f) => f.extensions[0])).toEqual(['md', 'txt'])
  })
})
```

`tests/main/fs-errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { describeFsError, errorCode } from '../../src/main/fs-errors'

const fsError = (code: string) => Object.assign(new Error(code), { code })

describe('파일 오류 안내', () => {
  it('권한 오류는 권한이 없다고 알려 준다', () => {
    expect(describeFsError(fsError('EACCES'))).toContain('권한이 없어')
    expect(describeFsError(fsError('EPERM'))).toContain('권한이 없어')
  })

  it('디스크가 꽉 차면 공간이 부족하다고 알려 준다', () => {
    expect(describeFsError(fsError('ENOSPC'))).toContain('디스크 공간이 부족')
  })

  it('모르는 오류는 오류 코드를 함께 보여 준다', () => {
    expect(describeFsError(fsError('EWEIRD'))).toContain('EWEIRD')
  })

  it('코드가 없는 오류는 메시지를 함께 보여 준다', () => {
    expect(describeFsError(new Error('boom'))).toContain('boom')
  })

  it('오류 코드가 있으면 꺼내고 없으면 없다고 한다', () => {
    expect(errorCode(fsError('ENOENT'))).toBe('ENOENT')
    expect(errorCode(new Error('x'))).toBeNull()
    expect(errorCode('text')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/file-format.test.ts tests/main/fs-errors.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/main/file-format.ts`:
```ts
import { extname } from 'node:path'
import type { FileFormat } from '../shared/types'

export type DialogFilter = { name: string; extensions: string[] }

const FORMAT_BY_EXTENSION: Record<string, FileFormat> = {
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
}

const SAVE_FILTER_BY_FORMAT: Record<FileFormat, DialogFilter> = {
  md: { name: 'Markdown (*.md)', extensions: ['md'] },
  txt: { name: 'Text (*.txt)', extensions: ['txt'] },
}

export const OPEN_DIALOG_FILTERS: DialogFilter[] = [
  { name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
]

export function formatFromPath(filePath: string): FileFormat | null {
  return FORMAT_BY_EXTENSION[extname(filePath).toLowerCase()] ?? null
}

export function ensureExtension(filePath: string, format: FileFormat): string {
  return formatFromPath(filePath) ? filePath : `${filePath}.${format}`
}

export function saveDialogFilters(preferred: FileFormat): DialogFilter[] {
  const other: FileFormat = preferred === 'md' ? 'txt' : 'md'
  return [SAVE_FILTER_BY_FORMAT[preferred], SAVE_FILTER_BY_FORMAT[other]]
}
```

`src/main/fs-errors.ts`:
```ts
const MESSAGE_BY_CODE: Record<string, string> = {
  EACCES: '권한이 없어 파일에 접근할 수 없습니다.',
  EPERM: '권한이 없어 파일에 접근할 수 없습니다.',
  EROFS: '읽기 전용 위치라 저장할 수 없습니다.',
  ENOSPC: '디스크 공간이 부족합니다.',
  ENOENT: '파일이나 폴더를 찾을 수 없습니다.',
  EBUSY: '다른 프로그램이 파일을 사용 중입니다.',
  EISDIR: '폴더는 열 수 없습니다.',
}

export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const { code } = error as { code: unknown }
  return typeof code === 'string' ? code : null
}

export function describeFsError(error: unknown): string {
  const code = errorCode(error)
  if (code && MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code]
  const detail = code ?? (error instanceof Error ? error.message : String(error))
  return `알 수 없는 오류가 발생했습니다. (${detail})`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/main/file-format.test.ts tests/main/fs-errors.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/file-format.ts src/main/fs-errors.ts tests/main/file-format.test.ts tests/main/fs-errors.test.ts
git commit -m "feat: 저장 형식 확장자 처리와 파일 오류 안내 추가"
```

---

### Task 4: 안전한 파일 쓰기

**Files:**
- Create: `src/main/atomic-write.ts`
- Test: `tests/main/atomic-write.test.ts`

**Interfaces:**
- Consumes: `errorCode` (Task 3)
- Produces: `writeFileAtomic(targetPath: string, data: string | Uint8Array, options?: AtomicWriteOptions): Promise<void>`, `type AtomicWriteFs = { writeFile(path: string, data: string | Uint8Array): Promise<void>; rename(from: string, to: string): Promise<void>; rm(path: string, options: { force: boolean }): Promise<void> }`, `type AtomicWriteOptions = { fs?: AtomicWriteFs; retries?: number; retryDelayMs?: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/atomic-write.test.ts`:
```ts
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic, type AtomicWriteFs } from '../../src/main/atomic-write'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-atomic-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function createFakeFs(renameErrorCodes: string[]) {
  const calls: string[] = []
  const fs: AtomicWriteFs = {
    writeFile: async (path) => {
      calls.push(`writeFile ${path}`)
    },
    rename: async () => {
      calls.push('rename')
      const code = renameErrorCodes.shift()
      if (code) throw Object.assign(new Error(code), { code })
    },
    rm: async (path) => {
      calls.push(`rm ${path}`)
    },
  }
  return { fs, calls }
}

describe('안전한 파일 쓰기', () => {
  it('새 파일에 내용을 쓴다', async () => {
    const target = join(directory, 'note.md')
    await writeFileAtomic(target, '# 새 글')
    expect(await readFile(target, 'utf8')).toBe('# 새 글')
  })

  it('기존 파일을 새 내용으로 바꾼다', async () => {
    const target = join(directory, 'note.md')
    await writeFile(target, '예전 내용')
    await writeFileAtomic(target, '새 내용')
    expect(await readFile(target, 'utf8')).toBe('새 내용')
  })

  it('저장이 끝나면 임시 파일을 남기지 않는다', async () => {
    await writeFileAtomic(join(directory, 'note.md'), '내용')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('한글과 공백이 들어간 경로에도 저장한다', async () => {
    const folder = join(directory, '내 문서')
    await mkdir(folder)
    const target = join(folder, '회의록 10월.md')
    await writeFileAtomic(target, '안건')
    expect(await readFile(target, 'utf8')).toBe('안건')
  })

  it('파일이 잠깐 잠겨 있으면 다시 시도해서 저장한다', async () => {
    const { fs, calls } = createFakeFs(['EBUSY', 'EBUSY'])
    await writeFileAtomic('/notes/a.md', '내용', { fs, retryDelayMs: 0 })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(3)
  })

  it('계속 잠겨 있으면 임시 파일을 지우고 실패를 알린다', async () => {
    const { fs, calls } = createFakeFs(Array(10).fill('EBUSY'))
    await expect(
      writeFileAtomic('/notes/a.md', '내용', { fs, retries: 5, retryDelayMs: 0 }),
    ).rejects.toMatchObject({ code: 'EBUSY' })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(6)
    expect(calls.at(-1)).toMatch(/^rm .*\.tmp$/)
  })

  it('잠금이 아닌 오류는 다시 시도하지 않는다', async () => {
    const { fs, calls } = createFakeFs(['ENOSPC'])
    await expect(writeFileAtomic('/notes/a.md', '내용', { fs, retryDelayMs: 0 })).rejects.toMatchObject({
      code: 'ENOSPC',
    })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/atomic-write.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/main/atomic-write.ts`:
```ts
import { randomBytes } from 'node:crypto'
import { promises as nodeFs } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { errorCode } from './fs-errors'

export type AtomicWriteFs = {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  rename(from: string, to: string): Promise<void>
  rm(path: string, options: { force: boolean }): Promise<void>
}

export type AtomicWriteOptions = {
  fs?: AtomicWriteFs
  retries?: number
  retryDelayMs?: number
}

const defaultFs: AtomicWriteFs = {
  writeFile: (path, data) => nodeFs.writeFile(path, data),
  rename: (from, to) => nodeFs.rename(from, to),
  rm: (path, options) => nodeFs.rm(path, options),
}

// Windows에서는 백신이나 검색 색인이 파일을 잠깐 잡고 있으면 교체가 이 코드들로 실패한다.
const LOCKED_FILE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

export async function writeFileAtomic(
  targetPath: string,
  data: string | Uint8Array,
  { fs = defaultFs, retries = 5, retryDelayMs = 50 }: AtomicWriteOptions = {},
): Promise<void> {
  const tempPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${randomBytes(4).toString('hex')}.tmp`,
  )
  try {
    await fs.writeFile(tempPath, data)
    await renameWithRetry(fs, tempPath, targetPath, retries, retryDelayMs)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function renameWithRetry(
  fs: AtomicWriteFs,
  from: string,
  to: string,
  retries: number,
  retryDelayMs: number,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const code = errorCode(error)
      const canRetry = code !== null && LOCKED_FILE_CODES.has(code) && attempt < retries
      if (!canRetry) throw error
      await sleep(retryDelayMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/main/atomic-write.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/atomic-write.ts tests/main/atomic-write.test.ts
git commit -m "feat: 임시 파일에 쓰고 교체하는 안전한 파일 쓰기 추가

교체 중 파일이 잠겨 있으면 최대 5번 다시 시도하고, 끝내 실패하면 임시
파일을 지우고 오류를 그대로 알린다."
```

---

### Task 5: 문서 읽기와 쓰기

**Files:**
- Create: `src/main/documents.ts`
- Test: `tests/main/documents.test.ts`

**Interfaces:**
- Consumes: `decodeText`, `encodeUtf8` (Task 2), `detectEol`, `normalizeToLf`, `applyEol` (Task 2), `describeFsError` (Task 3), `writeFileAtomic` (Task 4)
- Produces:
  - `LARGE_FILE_BYTES = 10 * 1024 * 1024`
  - `type ReadDocumentResult = { status: 'ok'; text: string; eol: Eol | null; encoding: SourceEncoding } | { status: 'tooLarge'; bytes: number } | { status: 'failed'; message: string }`
  - `readDocument(filePath: string, options?: { maxBytes?: number }): Promise<ReadDocumentResult>` — `text`는 LF로 바뀐 편집용 글
  - `type WriteDocumentRequest = { path: string; text: string; eol: Eol }`
  - `type WriteDocumentResult = { status: 'saved' } | { status: 'failed'; message: string }`
  - `type WriteBytes = (path: string, data: Uint8Array) => Promise<void>`
  - `writeDocument(request: WriteDocumentRequest, writeBytes?: WriteBytes): Promise<WriteDocumentResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/documents.test.ts`:
```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readDocument, writeDocument } from '../../src/main/documents'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-docs-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('문서 읽기', () => {
  it('CRLF 파일을 읽으면 편집용 LF 글과 원래 줄바꿈 방식을 함께 돌려준다', async () => {
    const path = join(directory, 'a.md')
    await writeFile(path, '첫 줄\r\n둘째 줄\r\n')
    expect(await readDocument(path)).toEqual({
      status: 'ok',
      text: '첫 줄\n둘째 줄\n',
      eol: 'crlf',
      encoding: 'utf-8',
    })
  })

  it('CP949 파일을 읽으면 원래 인코딩을 알려 준다', async () => {
    const path = join(directory, 'old.txt')
    await writeFile(path, new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]))
    expect(await readDocument(path)).toMatchObject({ status: 'ok', text: '한글', encoding: 'cp949' })
  })

  it('크기 제한보다 큰 파일은 읽지 않고 크기를 알려 준다', async () => {
    const path = join(directory, 'big.md')
    await writeFile(path, 'hello world')
    expect(await readDocument(path, { maxBytes: 4 })).toEqual({ status: 'tooLarge', bytes: 11 })
  })

  it('크기 제한을 풀면 큰 파일도 읽는다', async () => {
    const path = join(directory, 'big.md')
    await writeFile(path, 'hello world')
    expect(await readDocument(path, { maxBytes: Infinity })).toMatchObject({ status: 'ok', text: 'hello world' })
  })

  it('없는 파일을 읽으면 찾을 수 없다고 알려 준다', async () => {
    const result = await readDocument(join(directory, 'missing.md'))
    expect(result.status).toBe('failed')
    expect(result.status === 'failed' && result.message).toContain('찾을 수 없습니다')
  })
})

describe('문서 쓰기', () => {
  it('CRLF 문서는 CRLF 줄바꿈으로 저장한다', async () => {
    const path = join(directory, 'a.md')
    await writeDocument({ path, text: 'a\nb\n', eol: 'crlf' })
    expect(await readFile(path, 'utf8')).toBe('a\r\nb\r\n')
  })

  it('저장은 BOM 없는 UTF-8로 한다', async () => {
    const path = join(directory, 'a.md')
    await writeDocument({ path, text: '한', eol: 'lf' })
    expect(Array.from(await readFile(path))).toEqual([0xed, 0x95, 0x9c])
  })

  it('쓰기에 실패하면 이유를 알려 준다', async () => {
    const failingWrite = async () => {
      throw Object.assign(new Error('full'), { code: 'ENOSPC' })
    }
    const result = await writeDocument({ path: '/x/a.md', text: 'a', eol: 'lf' }, failingWrite)
    expect(result).toEqual({ status: 'failed', message: '디스크 공간이 부족합니다.' })
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/documents.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/main/documents.ts`:
```ts
import { readFile, stat } from 'node:fs/promises'
import { applyEol, detectEol, normalizeToLf } from '../shared/eol'
import type { Eol, SourceEncoding } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { describeFsError } from './fs-errors'
import { decodeText, encodeUtf8 } from './text-codec'

export const LARGE_FILE_BYTES = 10 * 1024 * 1024

export type ReadDocumentResult =
  | { status: 'ok'; text: string; eol: Eol | null; encoding: SourceEncoding }
  | { status: 'tooLarge'; bytes: number }
  | { status: 'failed'; message: string }

export type WriteDocumentRequest = { path: string; text: string; eol: Eol }
export type WriteDocumentResult = { status: 'saved' } | { status: 'failed'; message: string }
export type WriteBytes = (path: string, data: Uint8Array) => Promise<void>

export async function readDocument(
  filePath: string,
  { maxBytes = LARGE_FILE_BYTES }: { maxBytes?: number } = {},
): Promise<ReadDocumentResult> {
  try {
    const { size } = await stat(filePath)
    if (size > maxBytes) return { status: 'tooLarge', bytes: size }
    const { text, encoding } = decodeText(await readFile(filePath))
    return { status: 'ok', text: normalizeToLf(text), eol: detectEol(text), encoding }
  } catch (error) {
    return { status: 'failed', message: describeFsError(error) }
  }
}

export async function writeDocument(
  request: WriteDocumentRequest,
  writeBytes: WriteBytes = writeFileAtomic,
): Promise<WriteDocumentResult> {
  try {
    await writeBytes(request.path, encodeUtf8(applyEol(request.text, request.eol)))
    return { status: 'saved' }
  } catch (error) {
    return { status: 'failed', message: describeFsError(error) }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/main/documents.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/documents.ts tests/main/documents.test.ts
git commit -m "feat: 인코딩·줄바꿈·크기 제한을 처리하는 문서 읽기/쓰기 추가"
```

---

### Task 6: 설정 저장소와 백업 저장소

**Files:**
- Create: `src/main/settings-store.ts`, `src/main/backup-store.ts`
- Test: `tests/main/settings-store.test.ts`, `tests/main/backup-store.test.ts`

**Interfaces:**
- Consumes: `defaultSettings`, `normalizeSettings`, `Settings`, `Backup` (Task 1), `writeFileAtomic` (Task 4)
- Produces:
  - `type SettingsStore = { load(): Promise<Settings>; save(settings: Settings): Promise<void> }`
  - `createSettingsStore(options: { filePath: string; platform: string }): SettingsStore`
  - `type BackupStore = { write(backup: Backup): Promise<void>; read(): Promise<Backup | null>; clear(): Promise<void> }`
  - `createBackupStore(directory: string): BackupStore` — 백업 파일은 `{directory}/current.json`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/settings-store.test.ts`:
```ts
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../src/main/settings-store'
import { defaultSettings } from '../../src/shared/settings'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-settings-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('설정 파일', () => {
  it('설정 파일이 없으면 기본값으로 시작한다', async () => {
    const store = createSettingsStore({ filePath: join(directory, 'settings.json'), platform: 'win32' })
    expect(await store.load()).toEqual(defaultSettings('win32'))
  })

  it('저장한 설정을 다시 읽으면 그대로 돌아온다', async () => {
    const store = createSettingsStore({ filePath: join(directory, 'settings.json'), platform: 'win32' })
    const changed = { ...defaultSettings('win32'), theme: 'cmd' as const, fontSize: 18 }
    await store.save(changed)
    expect(await store.load()).toEqual(changed)
  })

  it('깨진 설정 파일은 settings.bad.json으로 옮기고 기본값으로 시작한다', async () => {
    const filePath = join(directory, 'settings.json')
    await writeFile(filePath, '{ this is not json')
    const store = createSettingsStore({ filePath, platform: 'darwin' })
    expect(await store.load()).toEqual(defaultSettings('darwin'))
    expect(await readdir(directory)).toEqual(['settings.bad.json'])
    expect(await readFile(join(directory, 'settings.bad.json'), 'utf8')).toBe('{ this is not json')
  })

  it('설정 폴더가 없어도 만들어서 저장한다', async () => {
    const filePath = join(directory, 'nested', 'settings.json')
    const store = createSettingsStore({ filePath, platform: 'win32' })
    await store.save(defaultSettings('win32'))
    expect(JSON.parse(await readFile(filePath, 'utf8')).theme).toBe('windows-terminal')
  })
})
```

`tests/main/backup-store.test.ts`:
```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackupStore } from '../../src/main/backup-store'
import type { Backup } from '../../src/shared/types'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-backup-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const sampleBackup: Backup = {
  path: 'C:\\notes\\회의록.md',
  content: '# 쓰다 만 글',
  eol: 'crlf',
  savedAt: '2026-10-08T05:00:00.000Z',
}

describe('자동 백업 저장소', () => {
  it('백업이 없으면 아무것도 돌려주지 않는다', async () => {
    expect(await createBackupStore(join(directory, 'backup')).read()).toBeNull()
  })

  it('쓴 백업을 그대로 다시 읽는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    expect(await store.read()).toEqual(sampleBackup)
  })

  it('새 문서의 백업은 경로 없이 저장된다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write({ ...sampleBackup, path: null })
    expect((await store.read())?.path).toBeNull()
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
    const backupDirectory = join(directory, 'backup')
    await mkdir(backupDirectory)
    await writeFile(join(backupDirectory, 'current.json'), '{"content": 1}')
    expect(await createBackupStore(backupDirectory).read()).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/settings-store.test.ts tests/main/backup-store.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/main/settings-store.ts`:
```ts
import { mkdir, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defaultSettings, normalizeSettings } from '../shared/settings'
import type { Settings } from '../shared/types'
import { writeFileAtomic } from './atomic-write'

export type SettingsStore = {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}

export function createSettingsStore({ filePath, platform }: { filePath: string; platform: string }): SettingsStore {
  async function moveBrokenFileAside(): Promise<void> {
    await rename(filePath, join(dirname(filePath), 'settings.bad.json')).catch(() => undefined)
  }

  return {
    async load() {
      let raw: string
      try {
        raw = await readFile(filePath, 'utf8')
      } catch {
        return defaultSettings(platform)
      }
      try {
        return normalizeSettings(JSON.parse(raw), platform)
      } catch {
        await moveBrokenFileAside()
        return defaultSettings(platform)
      }
    },
    async save(settings) {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFileAtomic(filePath, JSON.stringify(settings, null, 2))
    },
  }
}
```

`src/main/backup-store.ts`:
```ts
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Backup } from '../shared/types'
import { writeFileAtomic } from './atomic-write'

export type BackupStore = {
  write(backup: Backup): Promise<void>
  read(): Promise<Backup | null>
  clear(): Promise<void>
}

export function createBackupStore(directory: string): BackupStore {
  const filePath = join(directory, 'current.json')
  return {
    async write(backup) {
      await mkdir(directory, { recursive: true })
      await writeFileAtomic(filePath, JSON.stringify(backup))
    },
    async read() {
      try {
        const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
        return isBackup(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    async clear() {
      await rm(filePath, { force: true })
    },
  }
}

function isBackup(value: unknown): value is Backup {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.path === null || typeof candidate.path === 'string') &&
    typeof candidate.content === 'string' &&
    (candidate.eol === 'lf' || candidate.eol === 'crlf') &&
    typeof candidate.savedAt === 'string'
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/main/settings-store.test.ts tests/main/backup-store.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/settings-store.ts src/main/backup-store.ts tests/main/settings-store.test.ts tests/main/backup-store.test.ts
git commit -m "feat: 설정 파일과 자동 백업 파일 저장소 추가

깨진 설정 파일은 settings.bad.json으로 옮기고 기본값으로 시작해서 앱이
켜지지 않는 일이 없게 한다."
```

---

### Task 7: renderer API 타입과 열기/저장 흐름

**Files:**
- Create: `src/shared/api.ts`, `src/main/file-service.ts`
- Test: `tests/main/file-service.test.ts`

**Interfaces:**
- Consumes: `readDocument`, `writeDocument`, `ReadDocumentResult`, `WriteDocumentRequest`, `WriteDocumentResult` (Task 5), `ensureExtension`, `formatFromPath` (Task 3), `defaultEol` (Task 2)
- Produces:
  - `src/shared/api.ts`: `OpenedFile`, `OpenResult`, `SaveRequest`, `SaveResult`, `DiscardChoice`, `ImworkingApi` (아래 코드 그대로)
  - `src/main/file-service.ts`: `type FileDialogs`, `type FileService = { openWithDialog(defaultDirectory: string | null): Promise<OpenResult>; openPath(path: string): Promise<OpenResult>; save(request: SaveRequest): Promise<SaveResult> }`, `createFileService(deps: FileServiceDeps): FileService`

- [ ] **Step 1: API 타입 작성**

`src/shared/api.ts`:
```ts
import type { Backup, Eol, FileFormat, Settings, SourceEncoding } from './types'

export type OpenedFile = {
  path: string
  directory: string
  text: string
  eol: Eol
  encoding: SourceEncoding
  format: FileFormat
}

export type OpenResult =
  | { status: 'opened'; file: OpenedFile }
  | { status: 'canceled' }
  | { status: 'failed'; message: string }

export type SaveRequest = {
  path: string | null
  text: string
  eol: Eol
  saveAs: boolean
  defaultDirectory: string | null
  defaultFormat: FileFormat
}

export type SaveResult =
  | { status: 'saved'; path: string; directory: string; format: FileFormat }
  | { status: 'canceled' }
  | { status: 'failed'; message: string }

export type DiscardChoice = 'save' | 'discard' | 'cancel'

export type ImworkingApi = {
  platform: string
  defaultEol: Eol
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
  openFileDialog(defaultDirectory: string | null): Promise<OpenResult>
  openPath(path: string): Promise<OpenResult>
  saveFile(request: SaveRequest): Promise<SaveResult>
  confirmDiscard(): Promise<DiscardChoice>
  askRestoreBackup(savedAt: string): Promise<boolean>
  readBackup(): Promise<Backup | null>
  writeBackup(backup: Backup): Promise<void>
  clearBackup(): Promise<void>
  onCloseRequested(listener: () => void): void
  requestCloseWindow(): void
  closeWindowNow(): void
  minimizeWindow(): void
  toggleMaximizeWindow(): void
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/main/file-service.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import type { ReadDocumentResult } from '../../src/main/documents'
import { createFileService, type FileDialogs } from '../../src/main/file-service'
import type { SaveRequest } from '../../src/shared/api'

function createFakeDialogs(overrides: Partial<FileDialogs> = {}) {
  const shownErrors: string[] = []
  const dialogs: FileDialogs = {
    pickOpenPath: async () => null,
    pickSavePath: async () => null,
    confirmLargeFile: async () => false,
    showError: async (title, message) => {
      shownErrors.push(`${title}: ${message}`)
    },
    ...overrides,
  }
  return { dialogs, shownErrors }
}

const readOk =
  (text = '# 메모') =>
  async (): Promise<ReadDocumentResult> => ({ status: 'ok', text, eol: 'lf', encoding: 'utf-8' })

const savedWrite = () => vi.fn(async () => ({ status: 'saved' as const }))

const saveRequest = (overrides: Partial<SaveRequest> = {}): SaveRequest => ({
  path: null,
  text: '본문',
  eol: 'lf',
  saveAs: false,
  defaultDirectory: '/notes',
  defaultFormat: 'md',
  ...overrides,
})

describe('파일 열기', () => {
  it('열기 창에서 고른 파일을 읽어 돌려준다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.md' })
    const service = createFileService({ dialogs, platform: 'win32', read: readOk('# 메모') })
    expect(await service.openWithDialog('/notes')).toEqual({
      status: 'opened',
      file: { path: '/notes/a.md', directory: '/notes', text: '# 메모', eol: 'lf', encoding: 'utf-8', format: 'md' },
    })
  })

  it('열기 창을 취소하면 아무것도 열지 않는다', async () => {
    const read = vi.fn(readOk())
    const service = createFileService({ dialogs: createFakeDialogs().dialogs, platform: 'win32', read })
    expect(await service.openWithDialog(null)).toEqual({ status: 'canceled' })
    expect(read).not.toHaveBeenCalled()
  })

  it('줄바꿈이 없는 파일은 OS 기본 줄바꿈을 쓴다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.txt' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'ok', text: '한 줄', eol: null, encoding: 'utf-8' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result.status === 'opened' && result.file.eol).toBe('crlf')
  })

  it('큰 파일은 확인을 받은 뒤에 크기 제한 없이 읽는다', async () => {
    const { dialogs } = createFakeDialogs({
      pickOpenPath: async () => '/notes/big.md',
      confirmLargeFile: async () => true,
    })
    const read = vi
      .fn<(path: string, options?: { maxBytes?: number }) => Promise<ReadDocumentResult>>()
      .mockResolvedValueOnce({ status: 'tooLarge', bytes: 20_000_000 })
      .mockResolvedValueOnce({ status: 'ok', text: '큰 글', eol: 'lf', encoding: 'utf-8' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result.status).toBe('opened')
    expect(read).toHaveBeenLastCalledWith('/notes/big.md', { maxBytes: Infinity })
  })

  it('큰 파일 열기를 거절하면 열지 않는다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/big.md' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'tooLarge', bytes: 20_000_000 })
    expect(await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)).toEqual({
      status: 'canceled',
    })
  })

  it('읽기에 실패하면 이유를 보여 주고 실패를 알린다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.md' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'failed', message: '권한이 없어' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result).toEqual({ status: 'failed', message: '권한이 없어' })
    expect(shownErrors).toEqual(['파일을 열지 못했습니다: 권한이 없어'])
  })

  it('마지막 파일 다시 열기는 실패해도 오류 창을 띄우지 않는다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs()
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'failed', message: '없음' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openPath('/notes/gone.md')
    expect(result.status).toBe('failed')
    expect(shownErrors).toEqual([])
  })
})

describe('파일 저장', () => {
  it('경로가 있는 문서는 창 없이 같은 경로에 저장한다', async () => {
    const pickSavePath = vi.fn(async () => null)
    const write = savedWrite()
    const service = createFileService({ dialogs: createFakeDialogs({ pickSavePath }).dialogs, platform: 'win32', write })
    const result = await service.save(saveRequest({ path: '/notes/a.md', eol: 'crlf' }))
    expect(pickSavePath).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith({ path: '/notes/a.md', text: '본문', eol: 'crlf' })
    expect(result).toEqual({ status: 'saved', path: '/notes/a.md', directory: '/notes', format: 'md' })
  })

  it('새 문서는 저장 창에서 경로를 고르고 마지막 폴더의 untitled 이름을 제안한다', async () => {
    const pickSavePath = vi.fn(async () => '/notes/new.txt')
    const service = createFileService({
      dialogs: createFakeDialogs({ pickSavePath }).dialogs,
      platform: 'win32',
      write: savedWrite(),
    })
    await service.save(saveRequest({ defaultFormat: 'txt' }))
    expect(pickSavePath).toHaveBeenCalledWith(expect.stringMatching(/notes.untitled\.txt$/), 'txt')
  })

  it('다른 이름으로 저장은 경로가 있어도 저장 창을 띄운다', async () => {
    const pickSavePath = vi.fn(async () => '/notes/copy.md')
    const service = createFileService({
      dialogs: createFakeDialogs({ pickSavePath }).dialogs,
      platform: 'win32',
      write: savedWrite(),
    })
    const result = await service.save(saveRequest({ path: '/notes/a.md', saveAs: true }))
    expect(pickSavePath).toHaveBeenCalledWith('/notes/a.md', 'md')
    expect(result).toMatchObject({ status: 'saved', path: '/notes/copy.md' })
  })

  it('저장 창을 취소하면 저장하지 않는다', async () => {
    const write = savedWrite()
    const service = createFileService({ dialogs: createFakeDialogs().dialogs, platform: 'win32', write })
    expect(await service.save(saveRequest())).toEqual({ status: 'canceled' })
    expect(write).not.toHaveBeenCalled()
  })

  it('확장자 없이 고른 경로에는 고른 형식의 확장자를 붙여 저장한다', async () => {
    const write = savedWrite()
    const dialogs = createFakeDialogs({ pickSavePath: async () => '/notes/회의록' }).dialogs
    const result = await createFileService({ dialogs, platform: 'win32', write }).save(
      saveRequest({ defaultFormat: 'txt' }),
    )
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ path: '/notes/회의록.txt' }))
    expect(result).toMatchObject({ status: 'saved', path: '/notes/회의록.txt', format: 'txt' })
  })

  it('저장에 실패하면 이유를 보여 주고 실패를 알린다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs()
    const write = async () => ({ status: 'failed' as const, message: '디스크 공간이 부족합니다.' })
    const result = await createFileService({ dialogs, platform: 'win32', write }).save(
      saveRequest({ path: '/notes/a.md' }),
    )
    expect(result).toEqual({ status: 'failed', message: '디스크 공간이 부족합니다.' })
    expect(shownErrors).toEqual(['저장하지 못했습니다: 디스크 공간이 부족합니다.'])
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/file-service.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 4: 구현**

`src/main/file-service.ts`:
```ts
import { dirname, join } from 'node:path'
import type { OpenResult, SaveRequest, SaveResult } from '../shared/api'
import { defaultEol } from '../shared/eol'
import type { FileFormat } from '../shared/types'
import {
  readDocument,
  writeDocument,
  type ReadDocumentResult,
  type WriteDocumentRequest,
  type WriteDocumentResult,
} from './documents'
import { ensureExtension, formatFromPath } from './file-format'

export type FileDialogs = {
  pickOpenPath(defaultDirectory: string | null): Promise<string | null>
  pickSavePath(suggestedPath: string, preferredFormat: FileFormat): Promise<string | null>
  confirmLargeFile(bytes: number): Promise<boolean>
  showError(title: string, message: string): Promise<void>
}

export type FileServiceDeps = {
  dialogs: FileDialogs
  platform: string
  read?: (path: string, options?: { maxBytes?: number }) => Promise<ReadDocumentResult>
  write?: (request: WriteDocumentRequest) => Promise<WriteDocumentResult>
}

export type FileService = {
  openWithDialog(defaultDirectory: string | null): Promise<OpenResult>
  openPath(path: string): Promise<OpenResult>
  save(request: SaveRequest): Promise<SaveResult>
}

export function createFileService({
  dialogs,
  platform,
  read = readDocument,
  write = (request) => writeDocument(request),
}: FileServiceDeps): FileService {
  async function readWithSizeCheck(path: string): Promise<ReadDocumentResult | null> {
    const result = await read(path)
    if (result.status !== 'tooLarge') return result
    if (!(await dialogs.confirmLargeFile(result.bytes))) return null
    return read(path, { maxBytes: Infinity })
  }

  async function openFromPath(path: string, showErrors: boolean): Promise<OpenResult> {
    const result = await readWithSizeCheck(path)
    if (result === null) return { status: 'canceled' }
    if (result.status === 'ok') {
      return {
        status: 'opened',
        file: {
          path,
          directory: dirname(path),
          text: result.text,
          eol: result.eol ?? defaultEol(platform),
          encoding: result.encoding,
          format: formatFromPath(path) ?? 'txt',
        },
      }
    }
    const message = result.status === 'failed' ? result.message : '파일이 너무 커서 열 수 없습니다.'
    if (showErrors) await dialogs.showError('파일을 열지 못했습니다', message)
    return { status: 'failed', message }
  }

  return {
    async openWithDialog(defaultDirectory) {
      const path = await dialogs.pickOpenPath(defaultDirectory)
      return path ? openFromPath(path, true) : { status: 'canceled' }
    },

    openPath(path) {
      return openFromPath(path, false)
    },

    async save(request) {
      const needsDialog = request.saveAs || request.path === null
      const chosenPath = needsDialog
        ? await dialogs.pickSavePath(suggestedSavePath(request), request.defaultFormat)
        : request.path
      if (!chosenPath) return { status: 'canceled' }

      const path = ensureExtension(chosenPath, request.defaultFormat)
      const result = await write({ path, text: request.text, eol: request.eol })
      if (result.status === 'failed') {
        await dialogs.showError('저장하지 못했습니다', result.message)
        return result
      }
      return { status: 'saved', path, directory: dirname(path), format: formatFromPath(path) ?? request.defaultFormat }
    },
  }
}

function suggestedSavePath(request: SaveRequest): string {
  if (request.path) return request.path
  const fileName = `untitled.${request.defaultFormat}`
  return request.defaultDirectory ? join(request.defaultDirectory, fileName) : fileName
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/main/file-service.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 6: Commit**

```bash
git add src/shared/api.ts src/main/file-service.ts tests/main/file-service.test.ts
git commit -m "feat: renderer API 타입과 열기/저장 흐름 추가

대화상자는 주입받아서 흐름만 테스트한다. 큰 파일은 확인 후 열고, 확장자
없이 고른 경로에는 고른 형식의 확장자를 붙인다."
```

---

### Task 8: main 프로세스 조립 (창, 대화상자, IPC, preload)

**Files:**
- Create: `src/shared/ipc-channels.ts`, `src/main/window-bounds.ts`, `src/main/window.ts`, `src/main/dialogs.ts`, `src/main/close-guard.ts`, `src/main/ipc.ts`, `src/main/menu.ts`, `src/renderer/env.d.ts`
- Modify (전체 교체): `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.ts`
- Test: `tests/main/window-bounds.test.ts`

**Interfaces:**
- Consumes: Task 1~7의 main 모듈과 `ImworkingApi`
- Produces:
  - `IpcChannel` 상수
  - `boundsIfVisible(bounds: WindowBounds | null, workAreas: ScreenArea[]): WindowBounds | null`
  - renderer 전역 `window.imworking: ImworkingApi`

Electron에 붙는 코드(창, 대화상자, IPC)는 단위 테스트하지 않고 앱을 띄워서 확인한다. 판단 로직인 `boundsIfVisible`만 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/window-bounds.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { boundsIfVisible } from '../../src/main/window-bounds'

const laptopScreen = { x: 0, y: 0, width: 1920, height: 1040 }

describe('창 위치 복원', () => {
  it('저장된 위치가 화면 안에 있으면 그대로 쓴다', () => {
    const bounds = { x: 100, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(bounds, [laptopScreen])).toEqual(bounds)
  })

  it('모니터를 빼서 저장된 위치가 어느 화면에도 없으면 쓰지 않는다', () => {
    const onRemovedMonitor = { x: 2400, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(onRemovedMonitor, [laptopScreen])).toBeNull()
  })

  it('화면 가장자리에 조금만 걸쳐 있으면 쓰지 않는다', () => {
    const barelyVisible = { x: 1900, y: 100, width: 800, height: 600 }
    expect(boundsIfVisible(barelyVisible, [laptopScreen])).toBeNull()
  })

  it('두 번째 모니터에 있던 창은 그 모니터가 있으면 그대로 쓴다', () => {
    const secondScreen = { x: 1920, y: 0, width: 2560, height: 1400 }
    const bounds = { x: 2400, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(bounds, [laptopScreen, secondScreen])).toEqual(bounds)
  })

  it('저장된 위치가 없으면 쓰지 않는다', () => {
    expect(boundsIfVisible(null, [laptopScreen])).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/main/window-bounds.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현하고 테스트 통과 확인**

`src/main/window-bounds.ts`:
```ts
import type { WindowBounds } from '../shared/types'

export type ScreenArea = { x: number; y: number; width: number; height: number }

const MIN_VISIBLE_WIDTH = 100
const MIN_VISIBLE_HEIGHT = 50

export function boundsIfVisible(bounds: WindowBounds | null, workAreas: ScreenArea[]): WindowBounds | null {
  if (!bounds) return null
  const isVisible = workAreas.some(
    (area) =>
      overlapLength(bounds.x, bounds.width, area.x, area.width) >= MIN_VISIBLE_WIDTH &&
      overlapLength(bounds.y, bounds.height, area.y, area.height) >= MIN_VISIBLE_HEIGHT,
  )
  return isVisible ? bounds : null
}

function overlapLength(start: number, length: number, areaStart: number, areaLength: number): number {
  return Math.min(start + length, areaStart + areaLength) - Math.max(start, areaStart)
}
```

Run: `npx vitest run tests/main/window-bounds.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: IPC 채널 이름 작성**

`src/shared/ipc-channels.ts`:
```ts
export const IpcChannel = {
  loadSettings: 'settings:load',
  saveSettings: 'settings:save',
  openFileDialog: 'file:open-dialog',
  openPath: 'file:open-path',
  saveFile: 'file:save',
  confirmDiscard: 'dialog:confirm-discard',
  askRestoreBackup: 'dialog:ask-restore-backup',
  readBackup: 'backup:read',
  writeBackup: 'backup:write',
  clearBackup: 'backup:clear',
  closeRequested: 'window:close-requested',
  requestClose: 'window:request-close',
  closeNow: 'window:close-now',
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
} as const
```

- [ ] **Step 5: 창, 대화상자, 닫기 확인, 메뉴, IPC 작성**

`src/main/window.ts`:
```ts
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { WindowBounds } from '../shared/types'

export type MainWindowOptions = { platform: string; bounds: WindowBounds | null; preloadPath: string }

export function createMainWindow({ platform, bounds, preloadPath }: MainWindowOptions): BrowserWindow {
  const isMac = platform === 'darwin'
  const window = new BrowserWindow({
    ...(bounds ?? { width: 1100, height: 760 }),
    minWidth: 480,
    minHeight: 360,
    show: false,
    backgroundColor: '#0C0C0C',
    // Windows는 제목줄을 직접 그리고, macOS는 신호등 버튼만 남긴다.
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.once('ready-to-show', () => window.show())
  return window
}

export function loadRenderer(window: BrowserWindow, rendererDirectory: string): void {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
    window.webContents.openDevTools({ mode: 'detach' })
    return
  }
  void window.loadFile(join(rendererDirectory, 'index.html'))
}
```

`src/main/dialogs.ts`:
```ts
import { dialog, type BrowserWindow } from 'electron'
import type { DiscardChoice } from '../shared/api'
import { OPEN_DIALOG_FILTERS, saveDialogFilters } from './file-format'
import type { FileDialogs } from './file-service'

export type AppDialogs = FileDialogs & {
  confirmDiscard(): Promise<DiscardChoice>
  askRestoreBackup(savedAt: string): Promise<boolean>
}

const DISCARD_CHOICE_BY_BUTTON: DiscardChoice[] = ['save', 'discard', 'cancel']

export function createElectronDialogs(window: BrowserWindow): AppDialogs {
  return {
    async pickOpenPath(defaultDirectory) {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        defaultPath: defaultDirectory ?? undefined,
        filters: OPEN_DIALOG_FILTERS,
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    async pickSavePath(suggestedPath, preferredFormat) {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: suggestedPath,
        filters: saveDialogFilters(preferredFormat),
      })
      return result.canceled || !result.filePath ? null : result.filePath
    },

    async confirmLargeFile(bytes) {
      const megabytes = (bytes / 1024 / 1024).toFixed(1)
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['열기', '취소'],
        defaultId: 1,
        cancelId: 1,
        message: '큰 파일입니다.',
        detail: `${megabytes}MB 파일입니다. 열면 느려질 수 있습니다. 열까요?`,
      })
      return response === 0
    },

    async showError(title, message) {
      await dialog.showMessageBox(window, { type: 'error', buttons: ['확인'], message: title, detail: message })
    },

    async confirmDiscard() {
      const { response } = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['저장', '저장 안 함', '취소'],
        defaultId: 0,
        cancelId: 2,
        message: '저장하지 않은 변경 사항이 있습니다.',
        detail: '저장할까요?',
      })
      return DISCARD_CHOICE_BY_BUTTON[response] ?? 'cancel'
    },

    async askRestoreBackup(savedAt) {
      const { response } = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['복구', '버리기'],
        defaultId: 0,
        cancelId: 1,
        message: '저장되지 않은 글이 있습니다.',
        detail: `${new Date(savedAt).toLocaleString('ko-KR')}에 자동 백업된 내용을 복구할까요?`,
      })
      return response === 0
    },
  }
}
```

`src/main/close-guard.ts`:
```ts
import type { BrowserWindow } from 'electron'
import { IpcChannel } from '../shared/ipc-channels'

export type CloseGuard = { closeNow(): void }

export function installCloseGuard(window: BrowserWindow, beforeClose: () => Promise<void>): CloseGuard {
  let closeConfirmed = false

  window.on('close', (event) => {
    if (closeConfirmed) return
    event.preventDefault()
    window.webContents.send(IpcChannel.closeRequested)
  })

  // 화면 프로세스가 죽으면 저장 확인에 답할 수 없으므로 그냥 닫게 둔다.
  window.webContents.on('render-process-gone', () => {
    closeConfirmed = true
  })

  return {
    closeNow() {
      closeConfirmed = true
      void beforeClose()
        .catch(() => undefined)
        .finally(() => window.close())
    },
  }
}
```

`src/main/menu.ts`:
```ts
import { Menu } from 'electron'

export function applyAppMenu(platform: string): void {
  if (platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  // 되돌리기는 메뉴에 넣지 않는다. 메뉴 단축키가 먼저 잡으면 에디터의 되돌리기 기록이 동작하지 않는다.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { role: 'windowMenu' },
    ]),
  )
}
```

`src/main/ipc.ts`:
```ts
import { ipcMain, type BrowserWindow } from 'electron'
import type { SaveRequest } from '../shared/api'
import { IpcChannel } from '../shared/ipc-channels'
import type { Backup, Settings } from '../shared/types'
import type { BackupStore } from './backup-store'
import type { AppDialogs } from './dialogs'
import type { FileService } from './file-service'
import type { SettingsStore } from './settings-store'

export type IpcDeps = {
  window: BrowserWindow
  fileService: FileService
  settingsStore: SettingsStore
  backupStore: BackupStore
  dialogs: AppDialogs
  closeWindowNow(): void
}

export function registerIpcHandlers(deps: IpcDeps): void {
  const { window, fileService, settingsStore, backupStore, dialogs } = deps

  ipcMain.handle(IpcChannel.loadSettings, () => settingsStore.load())
  ipcMain.handle(IpcChannel.saveSettings, (_event, settings: Settings) => settingsStore.save(settings))
  ipcMain.handle(IpcChannel.openFileDialog, (_event, defaultDirectory: string | null) =>
    fileService.openWithDialog(defaultDirectory),
  )
  ipcMain.handle(IpcChannel.openPath, (_event, path: string) => fileService.openPath(path))
  ipcMain.handle(IpcChannel.saveFile, (_event, request: SaveRequest) => fileService.save(request))
  ipcMain.handle(IpcChannel.confirmDiscard, () => dialogs.confirmDiscard())
  ipcMain.handle(IpcChannel.askRestoreBackup, (_event, savedAt: string) => dialogs.askRestoreBackup(savedAt))
  ipcMain.handle(IpcChannel.readBackup, () => backupStore.read())
  ipcMain.handle(IpcChannel.writeBackup, (_event, backup: Backup) => backupStore.write(backup))
  ipcMain.handle(IpcChannel.clearBackup, () => backupStore.clear())

  ipcMain.on(IpcChannel.requestClose, () => window.close())
  ipcMain.on(IpcChannel.closeNow, () => deps.closeWindowNow())
  ipcMain.on(IpcChannel.minimize, () => window.minimize())
  ipcMain.on(IpcChannel.toggleMaximize, () => (window.isMaximized() ? window.unmaximize() : window.maximize()))
}
```

- [ ] **Step 6: main 진입점 교체**

`src/main/index.ts` (전체 교체):
```ts
import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { createBackupStore } from './backup-store'
import { installCloseGuard } from './close-guard'
import { createElectronDialogs } from './dialogs'
import { createFileService } from './file-service'
import { registerIpcHandlers } from './ipc'
import { applyAppMenu } from './menu'
import { createSettingsStore } from './settings-store'
import { createMainWindow, loadRenderer } from './window'
import { boundsIfVisible } from './window-bounds'

async function startApp(): Promise<void> {
  const platform = process.platform
  const userData = app.getPath('userData')
  const settingsStore = createSettingsStore({ filePath: join(userData, 'settings.json'), platform })
  const backupStore = createBackupStore(join(userData, 'backup'))
  const settings = await settingsStore.load()

  applyAppMenu(platform)
  const workAreas = screen.getAllDisplays().map((display) => display.workArea)
  const window = createMainWindow({
    platform,
    bounds: boundsIfVisible(settings.windowBounds, workAreas),
    preloadPath: join(__dirname, '../preload/index.js'),
  })

  const dialogs = createElectronDialogs(window)
  const closeGuard = installCloseGuard(window, async () => {
    const latest = await settingsStore.load()
    await settingsStore.save({ ...latest, windowBounds: window.getNormalBounds() })
  })
  registerIpcHandlers({
    window,
    fileService: createFileService({ dialogs, platform }),
    settingsStore,
    backupStore,
    dialogs,
    closeWindowNow: closeGuard.closeNow,
  })
  loadRenderer(window, join(__dirname, '../renderer'))
}

// 두 개를 띄우면 같은 백업 파일을 서로 덮어쓰므로 하나만 실행한다.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.whenReady().then(startApp)
  app.on('window-all-closed', () => app.quit())
}
```

- [ ] **Step 7: preload와 renderer 전역 타입 작성**

`src/preload/index.ts` (전체 교체):
```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { ImworkingApi } from '../shared/api'
import { defaultEol } from '../shared/eol'
import { IpcChannel } from '../shared/ipc-channels'

const api: ImworkingApi = {
  platform: process.platform,
  defaultEol: defaultEol(process.platform),
  loadSettings: () => ipcRenderer.invoke(IpcChannel.loadSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IpcChannel.saveSettings, settings),
  openFileDialog: (defaultDirectory) => ipcRenderer.invoke(IpcChannel.openFileDialog, defaultDirectory),
  openPath: (path) => ipcRenderer.invoke(IpcChannel.openPath, path),
  saveFile: (request) => ipcRenderer.invoke(IpcChannel.saveFile, request),
  confirmDiscard: () => ipcRenderer.invoke(IpcChannel.confirmDiscard),
  askRestoreBackup: (savedAt) => ipcRenderer.invoke(IpcChannel.askRestoreBackup, savedAt),
  readBackup: () => ipcRenderer.invoke(IpcChannel.readBackup),
  writeBackup: (backup) => ipcRenderer.invoke(IpcChannel.writeBackup, backup),
  clearBackup: () => ipcRenderer.invoke(IpcChannel.clearBackup),
  onCloseRequested: (listener) => {
    ipcRenderer.on(IpcChannel.closeRequested, () => listener())
  },
  requestCloseWindow: () => ipcRenderer.send(IpcChannel.requestClose),
  closeWindowNow: () => ipcRenderer.send(IpcChannel.closeNow),
  minimizeWindow: () => ipcRenderer.send(IpcChannel.minimize),
  toggleMaximizeWindow: () => ipcRenderer.send(IpcChannel.toggleMaximize),
}

contextBridge.exposeInMainWorld('imworking', api)
```

`src/renderer/env.d.ts`:
```ts
import type { ImworkingApi } from '../shared/api'

declare global {
  interface Window {
    imworking: ImworkingApi
  }
}

export {}
```

`src/renderer/main.ts` (Task 18에서 교체할 임시 버전):
```ts
const api = window.imworking
api.onCloseRequested(() => api.closeWindowNow())
document.getElementById('app')!.textContent = `imworkinghh (${api.platform})`
```

- [ ] **Step 8: 타입 검사와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 타입 오류 없음, 전체 테스트 PASS

- [ ] **Step 9: 앱 실행으로 확인**

Run: `npm run dev`
확인할 것:
1. Windows에서는 제목줄 없는 창이 뜨고 `imworkinghh (win32)`가 보인다.
2. 따로 뜬 개발자 도구 콘솔에서 `await window.imworking.loadSettings()`를 실행하면 기본 설정 객체가 나온다.
3. `Alt+F4`로 닫으면 창이 닫히고 `%APPDATA%\imworkinghh\settings.json`에 `windowBounds`가 저장되어 있다.
4. 다시 `npm run dev`를 하면 같은 위치와 크기로 뜬다.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "feat: main 프로세스 조립과 preload API 연결

창 생성, 대화상자, 닫기 전 확인, IPC, macOS 최소 메뉴를 연결하고
renderer에는 contextBridge로 ImworkingApi만 노출한다. 저장된 창 위치가
어느 화면에도 없으면 기본 위치로 띄운다."
```

---

### Task 9: 터미널 테마

**Files:**
- Create: `src/renderer/themes.ts`
- Test: `tests/renderer/themes.test.ts`

**Interfaces:**
- Consumes: `THEME_IDS`, `ThemeId` (Task 1)
- Produces:
  - `type TitlebarStyle = 'windows' | 'mac'`
  - `COLOR_TOKENS`, `type ColorToken`
  - `type Theme = { id: ThemeId; name: string; titlebarStyle: TitlebarStyle; windowTitle: string; promptTemplate: string; colors: Record<ColorToken, string> }`
  - `THEMES: Record<ThemeId, Theme>`, `getTheme(id: ThemeId): Theme`, `renderPrompt(theme: Theme, project: string): string`, `nextThemeId(current: ThemeId): ThemeId`, `themeCssVariables(theme: Theme): Record<string, string>` — 변수 이름은 `--color-{토큰의 kebab-case}` (예: `diffAddBackground` → `--color-diff-add-background`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/renderer/themes.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { COLOR_TOKENS, THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from '../../src/renderer/themes'
import { THEME_IDS } from '../../src/shared/types'

describe('터미널 테마', () => {
  it('모든 테마는 화면에 필요한 색을 빠짐없이 가진다', () => {
    for (const theme of Object.values(THEMES)) {
      for (const token of COLOR_TOKENS) {
        expect(theme.colors[token], `${theme.id}.${token}`).toMatch(/^(#|rgba?\()/)
      }
    }
  })

  it('설정에서 고를 수 있는 모든 테마 ID에 테마가 있다', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort())
  })

  it('PowerShell 프롬프트의 {project} 자리에 프로젝트 이름을 넣는다', () => {
    expect(renderPrompt(getTheme('powershell'), 'payments-api')).toBe('PS C:\\dev\\payments-api>')
  })

  it('WSL 테마 프롬프트는 리눅스 경로 형식이다', () => {
    expect(renderPrompt(getTheme('wsl-ubuntu'), 'payments-api')).toBe('user@DESKTOP:~/payments-api$')
  })

  it('맥 테마 프롬프트는 zsh 형식이다', () => {
    expect(renderPrompt(getTheme('macos-basic'), 'payments-api')).toBe('user@MacBook-Pro payments-api %')
  })

  it('테마 순환은 마지막 테마 다음에 처음 테마로 돌아간다', () => {
    expect(nextThemeId('windows-terminal')).toBe('powershell')
    expect(nextThemeId(THEME_IDS[THEME_IDS.length - 1])).toBe(THEME_IDS[0])
  })

  it('색은 CSS 변수 이름으로 바꿔서 적용할 수 있다', () => {
    const variables = themeCssVariables(getTheme('cmd'))
    expect(variables['--color-background']).toBe('#000000')
    expect(variables['--color-diff-add-background']).toBeDefined()
  })

  it('윈도우 계열 테마는 탭 제목줄, 맥 계열은 맥 제목줄을 쓴다', () => {
    expect(getTheme('wsl-ubuntu').titlebarStyle).toBe('windows')
    expect(getTheme('macos-homebrew').titlebarStyle).toBe('mac')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/themes.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/renderer/themes.ts`:
```ts
import { THEME_IDS, type ThemeId } from '../shared/types'

export type TitlebarStyle = 'windows' | 'mac'

export const COLOR_TOKENS = [
  'background',
  'foreground',
  'muted',
  'selection',
  'cursor',
  'gutter',
  'divider',
  'activeLine',
  'titlebarBackground',
  'titlebarForeground',
  'tabBackground',
  'statusBackground',
  'statusForeground',
  'prompt',
  'userInput',
  'toolBullet',
  'toolName',
  'toolArg',
  'result',
  'diffAdd',
  'diffRemove',
  'diffAddBackground',
  'diffRemoveBackground',
  'thinking',
  'success',
  'mdHeading',
  'mdStrong',
  'mdEmphasis',
  'mdCode',
  'mdLink',
  'mdQuote',
  'mdMeta',
] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

export type Theme = {
  id: ThemeId
  name: string
  titlebarStyle: TitlebarStyle
  windowTitle: string
  promptTemplate: string
  colors: Record<ColorToken, string>
}

type AnsiPalette = {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

const CLAUDE_ORANGE = '#D77757'
const HOMEBREW_GREEN = '#28FE14'

const CAMPBELL: AnsiPalette = {
  background: '#0C0C0C',
  foreground: '#CCCCCC',
  cursor: '#FFFFFF',
  selection: '#3A3D41',
  black: '#0C0C0C',
  red: '#C50F1F',
  green: '#13A10E',
  yellow: '#C19C00',
  blue: '#0037DA',
  magenta: '#881798',
  cyan: '#3A96DD',
  white: '#CCCCCC',
  brightBlack: '#767676',
  brightRed: '#E74856',
  brightGreen: '#16C60C',
  brightYellow: '#F9F1A5',
  brightBlue: '#3B78FF',
  brightMagenta: '#B4009E',
  brightCyan: '#61D6D6',
  brightWhite: '#F2F2F2',
}

const VINTAGE: AnsiPalette = {
  background: '#000000',
  foreground: '#C0C0C0',
  cursor: '#FFFFFF',
  selection: '#404040',
  black: '#000000',
  red: '#800000',
  green: '#008000',
  yellow: '#808000',
  blue: '#000080',
  magenta: '#800080',
  cyan: '#008080',
  white: '#C0C0C0',
  brightBlack: '#808080',
  brightRed: '#FF0000',
  brightGreen: '#00FF00',
  brightYellow: '#FFFF00',
  brightBlue: '#0000FF',
  brightMagenta: '#FF00FF',
  brightCyan: '#00FFFF',
  brightWhite: '#FFFFFF',
}

const UBUNTU: AnsiPalette = {
  background: '#300A24',
  foreground: '#EEEEEC',
  cursor: '#BBBBBB',
  selection: '#5E2750',
  black: '#2E3436',
  red: '#CC0000',
  green: '#4E9A06',
  yellow: '#C4A000',
  blue: '#3465A4',
  magenta: '#75507B',
  cyan: '#06989A',
  white: '#D3D7CF',
  brightBlack: '#8A8A8A',
  brightRed: '#EF2929',
  brightGreen: '#8AE234',
  brightYellow: '#FCE94F',
  brightBlue: '#729FCF',
  brightMagenta: '#AD7FA8',
  brightCyan: '#34E2E2',
  brightWhite: '#EEEEEC',
}

const TERMINAL_APP: AnsiPalette = {
  background: '#1E1E1E',
  foreground: '#E5E5E5',
  cursor: '#E5E5E5',
  selection: '#3F638B',
  black: '#000000',
  red: '#C23621',
  green: '#25BC24',
  yellow: '#ADAD27',
  blue: '#492EE1',
  magenta: '#D338D3',
  cyan: '#33BBC8',
  white: '#CBCCCD',
  brightBlack: '#818383',
  brightRed: '#FC391F',
  brightGreen: '#31E722',
  brightYellow: '#EAEC23',
  brightBlue: '#5833FF',
  brightMagenta: '#F935F8',
  brightCyan: '#14F0F0',
  brightWhite: '#E9EBEB',
}

const POWERSHELL_PALETTE: AnsiPalette = { ...CAMPBELL, background: '#012456', selection: '#1F4E8C' }

const HOMEBREW_PALETTE: AnsiPalette = {
  ...TERMINAL_APP,
  background: '#000000',
  foreground: HOMEBREW_GREEN,
  cursor: HOMEBREW_GREEN,
  selection: '#083905',
}

function colorsFromPalette(palette: AnsiPalette, titlebarBackground: string): Record<ColorToken, string> {
  return {
    background: palette.background,
    foreground: palette.foreground,
    muted: palette.brightBlack,
    selection: palette.selection,
    cursor: palette.cursor,
    gutter: palette.brightBlack,
    divider: palette.brightBlack,
    activeLine: 'rgba(255, 255, 255, 0.04)',
    titlebarBackground,
    titlebarForeground: palette.foreground,
    tabBackground: palette.background,
    statusBackground: palette.background,
    statusForeground: palette.brightBlack,
    prompt: palette.foreground,
    userInput: palette.brightWhite,
    toolBullet: palette.brightGreen,
    toolName: palette.brightWhite,
    toolArg: palette.foreground,
    result: palette.brightBlack,
    diffAdd: palette.brightGreen,
    diffRemove: palette.brightRed,
    diffAddBackground: 'rgba(46, 160, 67, 0.15)',
    diffRemoveBackground: 'rgba(248, 81, 73, 0.15)',
    thinking: CLAUDE_ORANGE,
    success: palette.brightGreen,
    mdHeading: palette.brightGreen,
    mdStrong: palette.brightYellow,
    mdEmphasis: palette.yellow,
    mdCode: palette.brightCyan,
    mdLink: palette.brightBlue,
    mdQuote: palette.brightBlack,
    mdMeta: palette.brightBlack,
  }
}

export const THEMES: Record<ThemeId, Theme> = {
  'windows-terminal': {
    id: 'windows-terminal',
    name: 'Windows Terminal',
    titlebarStyle: 'windows',
    windowTitle: 'Windows PowerShell',
    promptTemplate: 'PS C:\\dev\\{project}>',
    colors: colorsFromPalette(CAMPBELL, '#1F1F1F'),
  },
  powershell: {
    id: 'powershell',
    name: 'PowerShell',
    titlebarStyle: 'windows',
    windowTitle: 'Windows PowerShell',
    promptTemplate: 'PS C:\\dev\\{project}>',
    colors: colorsFromPalette(POWERSHELL_PALETTE, '#1F1F1F'),
  },
  cmd: {
    id: 'cmd',
    name: 'CMD',
    titlebarStyle: 'windows',
    windowTitle: '명령 프롬프트',
    promptTemplate: 'C:\\dev\\{project}>',
    colors: colorsFromPalette(VINTAGE, '#1F1F1F'),
  },
  'wsl-ubuntu': {
    id: 'wsl-ubuntu',
    name: 'WSL Ubuntu',
    titlebarStyle: 'windows',
    windowTitle: 'Ubuntu',
    promptTemplate: 'user@DESKTOP:~/{project}$',
    colors: colorsFromPalette(UBUNTU, '#1F1F1F'),
  },
  'macos-basic': {
    id: 'macos-basic',
    name: 'macOS Basic',
    titlebarStyle: 'mac',
    windowTitle: 'user — claude — 120×40',
    promptTemplate: 'user@MacBook-Pro {project} %',
    colors: colorsFromPalette(TERMINAL_APP, '#2B2B2B'),
  },
  'macos-homebrew': {
    id: 'macos-homebrew',
    name: 'macOS Homebrew',
    titlebarStyle: 'mac',
    windowTitle: 'user — claude — 120×40',
    promptTemplate: 'user@MacBook-Pro {project} %',
    colors: {
      ...colorsFromPalette(HOMEBREW_PALETTE, '#2B2B2B'),
      userInput: HOMEBREW_GREEN,
      toolName: HOMEBREW_GREEN,
      toolArg: HOMEBREW_GREEN,
    },
  },
}

export function getTheme(id: ThemeId): Theme {
  return THEMES[id]
}

export function renderPrompt(theme: Theme, project: string): string {
  return theme.promptTemplate.replaceAll('{project}', project)
}

export function nextThemeId(current: ThemeId): ThemeId {
  const index = THEME_IDS.indexOf(current)
  return THEME_IDS[(index + 1) % THEME_IDS.length]
}

export function themeCssVariables(theme: Theme): Record<string, string> {
  return Object.fromEntries(COLOR_TOKENS.map((token) => [`--color-${toKebabCase(token)}`, theme.colors[token]]))
}

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/themes.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/themes.ts tests/renderer/themes.test.ts
git commit -m "feat: Windows/macOS 터미널 테마 6종 추가

ANSI 팔레트에서 화면 색을 만들고, 테마마다 프롬프트 형식, 창 제목,
제목줄 모양을 정한다."
```

---

### Task 10: 가짜 Claude Code 세션 생성기

**Files:**
- Create: `src/renderer/fake/events.ts`, `src/renderer/fake/rng.ts`, `src/renderer/fake/pools.ts`, `src/renderer/fake/scenario.ts`
- Test: `tests/renderer/fake/rng.test.ts`, `tests/renderer/fake/scenario.test.ts`

**Interfaces:**
- Produces:
  - `events.ts`: `type LogRole`, `type LogSegment = { text: string; role: LogRole }`, `type FakeEvent`, `type LogSink = { appendLine(segments: LogSegment[]): void; replaceLastLine(segments: LogSegment[]): void }`
  - `rng.ts`: `type Rng = { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T; chance(probability: number): boolean }`, `createRng(seed: number): Rng`
  - `scenario.ts`: `type PromptForProject = (project: string) => string`, `TOOL_CALLS_PER_TASK = { min: 4, max: 10 }`, `generateTask(rng: Rng, promptFor: PromptForProject): FakeEvent[]`, `createSessionStream(seed: number, promptFor: PromptForProject): () => FakeEvent`

- [ ] **Step 1: 이벤트 타입 작성**

`src/renderer/fake/events.ts`:
```ts
export type LogRole =
  | 'prompt'
  | 'userInput'
  | 'toolBullet'
  | 'toolName'
  | 'toolArg'
  | 'result'
  | 'diffAdd'
  | 'diffRemove'
  | 'thinking'
  | 'success'
  | 'muted'

export type LogSegment = { text: string; role: LogRole }

export type FakeEvent =
  | { kind: 'line'; segments: LogSegment[]; delayMs: number }
  | { kind: 'typeOut'; text: string; role: LogRole; charDelayMs: number }
  | { kind: 'spinner'; label: string; durationMs: number }

export type LogSink = {
  appendLine(segments: LogSegment[]): void
  replaceLastLine(segments: LogSegment[]): void
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/renderer/fake/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/renderer/fake/rng'

describe('시드 고정 난수', () => {
  it('같은 시드면 같은 순서의 수를 만든다', () => {
    const first = createRng(42)
    const second = createRng(42)
    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()])
  })

  it('수는 0 이상 1 미만이다', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('정수는 양 끝을 포함한 범위 안에서 나온다', () => {
    const rng = createRng(1)
    const values = new Set(Array.from({ length: 500 }, () => rng.int(4, 6)))
    expect([...values].sort()).toEqual([4, 5, 6])
  })

  it('목록에서 고른 값은 항상 목록 안에 있다', () => {
    const rng = createRng(3)
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
  })
})
```

`tests/renderer/fake/scenario.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { FakeEvent } from '../../../src/renderer/fake/events'
import { createRng } from '../../../src/renderer/fake/rng'
import { TOOL_CALLS_PER_TASK, createSessionStream, generateTask } from '../../../src/renderer/fake/scenario'

type LineEvent = Extract<FakeEvent, { kind: 'line' }>

const testPrompt = (project: string) => `TEST[${project}]>`
const linesOf = (events: FakeEvent[]) => events.filter((event): event is LineEvent => event.kind === 'line')
const countToolCalls = (events: FakeEvent[]) =>
  linesOf(events).filter((line) => line.segments[0]?.role === 'toolBullet').length

describe('가짜 작업 생성', () => {
  it('같은 시드면 같은 작업을 만든다', () => {
    expect(generateTask(createRng(5), testPrompt)).toEqual(generateTask(createRng(5), testPrompt))
  })

  it('다른 시드면 다른 작업을 만든다', () => {
    expect(generateTask(createRng(5), testPrompt)).not.toEqual(generateTask(createRng(6), testPrompt))
  })

  it('작업은 프롬프트 줄, 요청 타이핑, 생각 중 표시 순서로 시작한다', () => {
    const [promptLine, , request, thinking] = generateTask(createRng(1), testPrompt)
    expect(promptLine.kind).toBe('line')
    expect(request.kind === 'typeOut' && request.text.startsWith('> ')).toBe(true)
    expect(thinking.kind).toBe('spinner')
  })

  it('프롬프트 줄은 주입한 함수가 만든 프롬프트를 쓴다', () => {
    const [promptLine] = generateTask(createRng(1), testPrompt)
    expect(promptLine.kind === 'line' && promptLine.segments[0].text).toMatch(/^TEST\[.+\]>$/)
  })

  it('도구 호출은 한 작업에 4개 이상 10개 이하다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const count = countToolCalls(generateTask(createRng(seed), testPrompt))
      expect(count).toBeGreaterThanOrEqual(TOOL_CALLS_PER_TASK.min)
      expect(count).toBeLessThanOrEqual(TOOL_CALLS_PER_TASK.max)
    }
  })

  it('작업은 성공 요약으로 끝난다', () => {
    const nonBlankLines = linesOf(generateTask(createRng(9), testPrompt)).filter((line) => line.segments.length > 0)
    expect(nonBlankLines.at(-1)?.segments[0].role).toBe('success')
  })

  it('모든 대기 시간은 0 이상이다', () => {
    for (const event of generateTask(createRng(11), testPrompt)) {
      const wait =
        event.kind === 'line' ? event.delayMs : event.kind === 'typeOut' ? event.charDelayMs : event.durationMs
      expect(wait).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('가짜 세션 흐름', () => {
  it('작업이 끝나면 이어서 다음 작업을 만든다', () => {
    const next = createSessionStream(3, testPrompt)
    const events = Array.from({ length: 2000 }, next)
    const promptLines = linesOf(events).filter((line) => line.segments[0]?.role === 'prompt')
    expect(promptLines.length).toBeGreaterThanOrEqual(2)
  })

  it('같은 시드의 세션은 같은 순서로 이벤트를 낸다', () => {
    const first = createSessionStream(8, testPrompt)
    const second = createSessionStream(8, testPrompt)
    expect(Array.from({ length: 300 }, first)).toEqual(Array.from({ length: 300 }, second))
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/fake`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 4: 난수와 재료 구현**

`src/renderer/fake/rng.ts`:
```ts
export type Rng = {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(probability: number): boolean
}

// mulberry32. 시드가 같으면 같은 순서를 만들어서 테스트에서 결과를 고정할 수 있다.
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  }
}
```

`src/renderer/fake/pools.ts`:
```ts
export const PROJECTS = [
  'payments-api',
  'auth-service',
  'web-dashboard',
  'data-pipeline',
  'notification-worker',
  'search-indexer',
  'billing-core',
  'admin-console',
  'mobile-bff',
  'event-gateway',
] as const

export const REQUESTS = [
  'fix the flaky retry test in billing',
  'add pagination to the invoices endpoint',
  'refactor the session cache to use a TTL map',
  'investigate why the webhook handler times out',
  'migrate the user repository to the new query builder',
  'add input validation to the signup form',
  'reduce bundle size of the dashboard charts',
  'write tests for the rate limiter edge cases',
  'clean up unused feature flags',
  'make the export job resumable after a crash',
  'add structured logging to the payment flow',
  'fix the race condition in the token refresh',
] as const

export const FILE_PATHS = [
  'src/billing/retry.ts',
  'src/billing/invoice-service.ts',
  'src/auth/session.ts',
  'src/auth/token-refresh.ts',
  'src/api/routes/invoices.ts',
  'src/api/middleware/rate-limit.ts',
  'src/db/user-repository.ts',
  'src/db/query-builder.ts',
  'src/jobs/export-job.ts',
  'src/webhooks/handler.ts',
  'src/lib/logger.ts',
  'src/lib/cache.ts',
  'src/config/feature-flags.ts',
  'src/ui/charts/RevenueChart.tsx',
  'src/ui/forms/SignupForm.tsx',
  'tests/billing/retry.test.ts',
  'tests/auth/session.test.ts',
  'tests/api/invoices.test.ts',
] as const

export const SYMBOLS = [
  'retryPolicy',
  'handleWebhook',
  'refreshToken',
  'paginate',
  'createInvoice',
  'SessionCache',
  'validateSignup',
  'rateLimiter',
  'exportCursor',
  'featureFlags',
  'withTransaction',
  'parseCursor',
] as const

export const GLOB_PATTERNS = [
  'src/**/*.ts',
  'tests/**/*.test.ts',
  'src/**/*.tsx',
  '**/package.json',
  'src/db/**/*.ts',
] as const

export const SEARCH_QUERIES = [
  'node.js exponential backoff jitter best practice',
  'postgres cursor pagination vs offset performance',
  'typescript discriminated union exhaustive check',
  'jwt refresh token rotation race condition',
  'vite bundle analyzer tree shaking chart library',
  'zod schema async refinement',
] as const

export const DOC_URLS = [
  'https://nodejs.org/api/timers.html',
  'https://www.postgresql.org/docs/current/queries-limit.html',
  'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
  'https://vitejs.dev/guide/build.html',
  'https://zod.dev/?id=refine',
] as const

export const DIFF_CHANGES: readonly { removed: string[]; added: string[] }[] = [
  { removed: ['  return token.user'], added: ['  if (!token) return null', '  return token.user'] },
  {
    removed: ['  const delay = 1000'],
    added: ['  const delay = Math.min(2 ** attempt * 100, 5000)', '  const jitter = Math.random() * delay * 0.2'],
  },
  {
    removed: ['  const rows = await db.query(sql)'],
    added: ['  const rows = await db.query(sql, { limit, cursor })', '  const next = rows.at(-1)?.id ?? null'],
  },
  {
    removed: ['export async function handleWebhook(req) {'],
    added: ['export async function handleWebhook(req, { signal }) {', '  signal.throwIfAborted()'],
  },
  {
    removed: ['    logger.info("payment " + id)'],
    added: ['    logger.info({ paymentId: id, status }, "payment updated")'],
  },
  {
    removed: ['  if (cache.has(key)) return cache.get(key)'],
    added: ['  const hit = cache.get(key)', '  if (hit && hit.expiresAt > now()) return hit.value'],
  },
  { removed: [], added: ['  if (!email.includes("@")) throw new ValidationError("email")'] },
]

export const COMMAND_RUNS: readonly { command: string; output: string }[] = [
  { command: 'npm test -- billing', output: 'PASS  tests/billing/retry.test.ts (12 tests)' },
  { command: 'npm test -- auth', output: 'PASS  tests/auth/session.test.ts (18 tests)' },
  { command: 'npx tsc --noEmit', output: 'No type errors' },
  { command: 'npm run lint', output: '✔ 0 problems' },
  { command: 'npm test', output: 'Tests: 214 passed, 214 total' },
  { command: 'npm run build', output: '✓ built in 4.21s' },
]

export const TODO_ITEMS = [
  'Reproduce the failure locally',
  'Read the existing implementation',
  'Write a failing test',
  'Implement the fix',
  'Run the full test suite',
  'Update the changelog',
] as const

export const SPINNER_LABELS = [
  'Thinking',
  'Pondering',
  'Cogitating',
  'Reticulating',
  'Percolating',
  'Synthesizing',
  'Noodling',
  'Brewing',
  'Spelunking',
  'Crafting',
] as const

export const SUMMARIES = [
  'All tests passing. The fix is ready for review.',
  'Done. Added the change and covered it with tests.',
  'Implemented and verified locally — build and tests are green.',
  'Refactor complete; behavior unchanged and tests pass.',
] as const
```

- [ ] **Step 5: 생성기 구현**

`src/renderer/fake/scenario.ts`:
```ts
import type { FakeEvent, LogSegment } from './events'
import {
  COMMAND_RUNS,
  DIFF_CHANGES,
  DOC_URLS,
  FILE_PATHS,
  GLOB_PATTERNS,
  PROJECTS,
  REQUESTS,
  SEARCH_QUERIES,
  SPINNER_LABELS,
  SUMMARIES,
  SYMBOLS,
  TODO_ITEMS,
} from './pools'
import { createRng, type Rng } from './rng'

export type PromptForProject = (project: string) => string

export const TOOL_CALLS_PER_TASK = { min: 4, max: 10 }

type ToolStep = (rng: Rng) => FakeEvent[]

function line(segments: LogSegment[], delayMs: number): FakeEvent {
  return { kind: 'line', segments, delayMs }
}

function blankLine(delayMs: number): FakeEvent {
  return line([], delayMs)
}

function toolCall(name: string, argument: string | null, delayMs: number): FakeEvent {
  const segments: LogSegment[] = [
    { text: '● ', role: 'toolBullet' },
    { text: name, role: 'toolName' },
  ]
  if (argument !== null) segments.push({ text: `(${argument})`, role: 'toolArg' })
  return line(segments, delayMs)
}

function toolResult(text: string, rng: Rng): FakeEvent {
  return line(
    [
      { text: '  ⎿  ', role: 'muted' },
      { text, role: 'result' },
    ],
    rng.int(400, 1200),
  )
}

const grepStep: ToolStep = (rng) => [
  toolCall('Grep', `pattern: "${rng.pick(SYMBOLS)}", path: "src/"`, rng.int(250, 700)),
  toolResult(`Found ${rng.int(2, 14)} files`, rng),
]

const globStep: ToolStep = (rng) => [
  toolCall('Glob', `pattern: "${rng.pick(GLOB_PATTERNS)}"`, rng.int(250, 700)),
  toolResult(`Found ${rng.int(8, 120)} files`, rng),
]

const readStep: ToolStep = (rng) => [
  toolCall('Read', rng.pick(FILE_PATHS), rng.int(250, 700)),
  toolResult(`Read ${rng.int(40, 480)} lines`, rng),
]

const updateStep: ToolStep = (rng) => {
  const path = rng.pick(FILE_PATHS)
  const change = rng.pick(DIFF_CHANGES)
  const firstLineNumber = rng.int(12, 240)
  const diffLine = (sign: '-' | '+', code: string, offset: number): FakeEvent =>
    line(
      [
        {
          text: `      ${String(firstLineNumber + offset).padStart(4)} ${sign} ${code}`,
          role: sign === '-' ? 'diffRemove' : 'diffAdd',
        },
      ],
      60,
    )
  return [
    toolCall('Update', path, rng.int(250, 700)),
    toolResult(`Updated ${path} with ${change.added.length} additions and ${change.removed.length} removals`, rng),
    ...change.removed.map((code, offset) => diffLine('-', code, offset)),
    ...change.added.map((code, offset) => diffLine('+', code, offset)),
  ]
}

const bashStep: ToolStep = (rng) => {
  const run = rng.pick(COMMAND_RUNS)
  return [toolCall('Bash', run.command, rng.int(1200, 3000)), toolResult(run.output, rng)]
}

const webSearchStep: ToolStep = (rng) => [
  toolCall('Web Search', `"${rng.pick(SEARCH_QUERIES)}"`, rng.int(800, 2000)),
  toolResult(`Did 1 search in ${rng.int(1, 4)}s`, rng),
]

const webFetchStep: ToolStep = (rng) => [
  toolCall('Fetch', rng.pick(DOC_URLS), rng.int(800, 2000)),
  toolResult(`Received ${(rng.int(40, 900) / 10).toFixed(1)}KB (200 OK)`, rng),
]

const todoStep: ToolStep = (rng) => {
  const doneCount = rng.int(1, 3)
  const items = TODO_ITEMS.slice(0, doneCount + 2)
  return [
    toolCall('Update Todos', null, rng.int(250, 700)),
    ...items.map((item, index) =>
      line(
        [
          { text: index === 0 ? '  ⎿  ' : '     ', role: 'muted' },
          { text: `${index < doneCount ? '☒' : '☐'} ${item}`, role: index < doneCount ? 'muted' : 'result' },
        ],
        80,
      ),
    ),
  ]
}

// 읽기와 수정이 더 자주 나오도록 같은 단계를 두 번씩 넣는다.
const TOOL_STEPS: readonly ToolStep[] = [
  grepStep,
  globStep,
  readStep,
  readStep,
  updateStep,
  updateStep,
  bashStep,
  webSearchStep,
  webFetchStep,
  todoStep,
]

export function generateTask(rng: Rng, promptFor: PromptForProject): FakeEvent[] {
  const project = rng.pick(PROJECTS)
  const events: FakeEvent[] = [
    line(
      [
        { text: promptFor(project), role: 'prompt' },
        { text: ' claude', role: 'userInput' },
      ],
      700,
    ),
    blankLine(300),
    { kind: 'typeOut', text: `> ${rng.pick(REQUESTS)}`, role: 'userInput', charDelayMs: rng.int(25, 60) },
    { kind: 'spinner', label: rng.pick(SPINNER_LABELS), durationMs: rng.int(1500, 6000) },
  ]

  const toolCallCount = rng.int(TOOL_CALLS_PER_TASK.min, TOOL_CALLS_PER_TASK.max)
  for (let i = 0; i < toolCallCount; i++) {
    events.push(...rng.pick(TOOL_STEPS)(rng))
    if (rng.chance(0.3)) {
      events.push({ kind: 'spinner', label: rng.pick(SPINNER_LABELS), durationMs: rng.int(1000, 4000) })
    }
  }

  events.push(
    blankLine(200),
    line(
      [
        { text: '✓ ', role: 'success' },
        { text: rng.pick(SUMMARIES), role: 'success' },
      ],
      1500,
    ),
    blankLine(2500),
  )
  return events
}

export function createSessionStream(seed: number, promptFor: PromptForProject): () => FakeEvent {
  const rng = createRng(seed)
  let pending: FakeEvent[] = []
  return () => {
    if (pending.length === 0) pending = generateTask(rng, promptFor)
    return pending.shift()!
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/fake`
Expected: PASS (13 tests)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/fake tests/renderer/fake
git commit -m "feat: 가짜 Claude Code 세션 이벤트 생성기 추가

프롬프트 → 요청 타이핑 → Thinking → 도구 호출 4~10개 → 성공 요약 순서로
작업을 만들고, 끝나면 다음 작업을 이어서 만든다. 시드가 같으면 결과가
같아서 테스트할 수 있다."
```

---

### Task 11: 로그 속도와 타이핑 연동

**Files:**
- Create: `src/renderer/fake/pacing.ts`
- Test: `tests/renderer/fake/pacing.test.ts`

**Interfaces:**
- Consumes: `LogSpeed` (Task 1), `FakeEvent` (Task 10)
- Produces:
  - `SPEED_MULTIPLIERS: Record<LogSpeed, number>`, `TYPING_ACTIVE_WINDOW_MS = 3000`, `TYPING_IDLE_AFTER_MS = 15000`, `IDLE_THINKING_MS = 20000`
  - `type TypingState = 'active' | 'normal' | 'idle'`
  - `type TypingActivity = { markTyped(): void; state(): TypingState }`, `createTypingActivity(now: () => number): TypingActivity`
  - `delayMultiplier(options: { speed: LogSpeed; typingLink: boolean; typingState: TypingState }): number`
  - `withIdleThinking(nextEvent: () => FakeEvent, isIdle: () => boolean): () => FakeEvent`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/renderer/fake/pacing.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { FakeEvent } from '../../../src/renderer/fake/events'
import {
  IDLE_THINKING_MS,
  createTypingActivity,
  delayMultiplier,
  withIdleThinking,
} from '../../../src/renderer/fake/pacing'

function createClock() {
  let time = 0
  return { now: () => time, advance: (ms: number) => (time += ms) }
}

const normalEvent: FakeEvent = { kind: 'line', segments: [{ text: 'log', role: 'result' }], delayMs: 100 }

describe('로그 속도', () => {
  it('느림은 1.6배, 보통은 1배, 빠름은 0.5배로 기다린다', () => {
    expect(delayMultiplier({ speed: 'slow', typingLink: false, typingState: 'normal' })).toBe(1.6)
    expect(delayMultiplier({ speed: 'normal', typingLink: false, typingState: 'normal' })).toBe(1)
    expect(delayMultiplier({ speed: 'fast', typingLink: false, typingState: 'normal' })).toBe(0.5)
  })
})

describe('타이핑 연동', () => {
  it('마지막 입력 후 3초 안이면 입력 중 상태다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    activity.markTyped()
    clock.advance(3000)
    expect(activity.state()).toBe('active')
  })

  it('3초가 지나면 보통 상태로 돌아간다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    activity.markTyped()
    clock.advance(3001)
    expect(activity.state()).toBe('normal')
  })

  it('15초 넘게 입력이 없으면 쉬는 상태다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    clock.advance(15_001)
    expect(activity.state()).toBe('idle')
  })

  it('입력 중이면 로그가 두 배 빨라진다', () => {
    expect(delayMultiplier({ speed: 'normal', typingLink: true, typingState: 'active' })).toBe(0.5)
  })

  it('타이핑 연동을 끄면 입력 중이어도 속도가 그대로다', () => {
    expect(delayMultiplier({ speed: 'normal', typingLink: false, typingState: 'active' })).toBe(1)
  })

  it('쉬는 상태가 되면 다음 이벤트로 긴 생각 중 표시를 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => true)
    expect(next()).toEqual({ kind: 'spinner', label: 'Thinking', durationMs: IDLE_THINKING_MS })
  })

  it('긴 생각 중 표시는 쉬는 동안 한 번만 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => true)
    next()
    expect(next()).toBe(normalEvent)
    expect(next()).toBe(normalEvent)
  })

  it('다시 입력하고 또 쉬면 긴 생각 중 표시를 다시 낸다', () => {
    let idle = true
    const next = withIdleThinking(() => normalEvent, () => idle)
    next()
    idle = false
    next()
    idle = true
    expect(next().kind).toBe('spinner')
  })

  it('쉬는 상태가 아니면 원래 이벤트를 그대로 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => false)
    expect(next()).toBe(normalEvent)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/fake/pacing.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/renderer/fake/pacing.ts`:
```ts
import type { LogSpeed } from '../../shared/types'
import type { FakeEvent } from './events'

export const SPEED_MULTIPLIERS: Record<LogSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5 }
export const TYPING_ACTIVE_WINDOW_MS = 3000
export const TYPING_IDLE_AFTER_MS = 15000
export const TYPING_ACTIVE_MULTIPLIER = 0.5
export const IDLE_THINKING_MS = 20000

export type TypingState = 'active' | 'normal' | 'idle'

export type TypingActivity = {
  markTyped(): void
  state(): TypingState
}

export function createTypingActivity(now: () => number): TypingActivity {
  let lastTypedAt = now()
  return {
    markTyped() {
      lastTypedAt = now()
    },
    state() {
      const elapsed = now() - lastTypedAt
      if (elapsed <= TYPING_ACTIVE_WINDOW_MS) return 'active'
      if (elapsed > TYPING_IDLE_AFTER_MS) return 'idle'
      return 'normal'
    },
  }
}

export function delayMultiplier({
  speed,
  typingLink,
  typingState,
}: {
  speed: LogSpeed
  typingLink: boolean
  typingState: TypingState
}): number {
  const typingFactor = typingLink && typingState === 'active' ? TYPING_ACTIVE_MULTIPLIER : 1
  return SPEED_MULTIPLIERS[speed] * typingFactor
}

export function withIdleThinking(nextEvent: () => FakeEvent, isIdle: () => boolean): () => FakeEvent {
  let thoughtDuringThisIdle = false
  return () => {
    if (!isIdle()) {
      thoughtDuringThisIdle = false
      return nextEvent()
    }
    if (thoughtDuringThisIdle) return nextEvent()
    thoughtDuringThisIdle = true
    return { kind: 'spinner', label: 'Thinking', durationMs: IDLE_THINKING_MS }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/fake/pacing.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/fake/pacing.ts tests/renderer/fake/pacing.test.ts
git commit -m "feat: 로그 속도 배율과 타이핑 연동 추가

입력 중에는 로그를 두 배 빠르게 흘리고, 15초 넘게 쉬면 긴 Thinking을
한 번 보여 준다. 시계는 주입받아 테스트한다."
```

---

### Task 12: 가짜 세션 출력기와 로그 화면

**Files:**
- Create: `src/renderer/fake/player.ts`, `src/renderer/fake/log-view.ts`
- Test: `tests/renderer/fake/player.test.ts`, `tests/renderer/fake/log-view.test.ts`

**Interfaces:**
- Consumes: `FakeEvent`, `LogSegment`, `LogSink` (Task 10)
- Produces:
  - `player.ts`: `SPINNER_FRAME_MS = 250`, `type Player = { start(): void; pause(): void; resume(): void; isPaused(): boolean }`, `createPlayer(options: { nextEvent: () => FakeEvent; sink: LogSink; delayMultiplier: () => number }): Player`
  - `log-view.ts`: `MAX_LOG_LINES = 3000`, `createLogView(container: HTMLElement, options?: { maxLines?: number }): LogSink` — 줄은 `div.log-line`, 조각은 `span.role-{role}`

- [ ] **Step 1: 실패하는 출력기 테스트 작성**

`tests/renderer/fake/player.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeEvent, LogSegment, LogSink } from '../../../src/renderer/fake/events'
import { createPlayer } from '../../../src/renderer/fake/player'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function createRecordingSink() {
  const lines: string[] = []
  const textOf = (segments: LogSegment[]) => segments.map((segment) => segment.text).join('')
  const sink: LogSink = {
    appendLine: (segments) => {
      lines.push(textOf(segments))
    },
    replaceLastLine: (segments) => {
      lines[lines.length - 1] = textOf(segments)
    },
  }
  return { sink, lines }
}

function eventsInOrder(events: FakeEvent[]): () => FakeEvent {
  let index = 0
  return () => events[index++ % events.length]
}

const textLine = (text: string, delayMs = 100): FakeEvent => ({
  kind: 'line',
  segments: [{ text, role: 'result' }],
  delayMs,
})

describe('가짜 세션 출력기', () => {
  it('시작하면 첫 줄을 바로 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a')]), sink, delayMultiplier: () => 1 }).start()
    expect(lines).toEqual(['a'])
  })

  it('줄마다 정해진 시간만큼 기다린 뒤 다음 줄을 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 1 }).start()
    vi.advanceTimersByTime(99)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(1)
    expect(lines).toEqual(['a', 'b'])
  })

  it('대기 시간에 속도 배율을 곱한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 2 }).start()
    vi.advanceTimersByTime(100)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(100)
    expect(lines).toEqual(['a', 'b'])
  })

  it('타이핑 이벤트는 한 글자씩 늘어나며 같은 줄을 고쳐 쓴다', () => {
    const { sink, lines } = createRecordingSink()
    const typeOut: FakeEvent = { kind: 'typeOut', text: 'abc', role: 'userInput', charDelayMs: 10 }
    createPlayer({ nextEvent: eventsInOrder([typeOut]), sink, delayMultiplier: () => 1 }).start()
    expect(lines).toEqual([''])
    vi.advanceTimersByTime(10)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(20)
    expect(lines).toEqual(['abc'])
  })

  it('생각 중 표시는 같은 줄에서 경과 초를 올리고 끝나면 걸린 시간을 남긴다', () => {
    const { sink, lines } = createRecordingSink()
    const spinner: FakeEvent = { kind: 'spinner', label: 'Thinking', durationMs: 2000 }
    createPlayer({ nextEvent: eventsInOrder([spinner, textLine('next')]), sink, delayMultiplier: () => 1 }).start()
    expect(lines[0]).toContain('Thinking… (0s')
    vi.advanceTimersByTime(1000)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Thinking… (1s')
    vi.advanceTimersByTime(1000)
    expect(lines[0]).toBe('✻ Thinking for 2s')
  })

  it('일시정지하면 더 출력하지 않는다', () => {
    const { sink, lines } = createRecordingSink()
    const player = createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 1 })
    player.start()
    player.pause()
    vi.advanceTimersByTime(10_000)
    expect(lines).toEqual(['a'])
    expect(player.isPaused()).toBe(true)
  })

  it('재개하면 멈춘 다음 줄부터 이어서 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    const player = createPlayer({
      nextEvent: eventsInOrder([textLine('a'), textLine('b'), textLine('c')]),
      sink,
      delayMultiplier: () => 1,
    })
    player.start()
    player.pause()
    player.resume()
    expect(lines).toEqual(['a', 'b'])
    expect(player.isPaused()).toBe(false)
  })
})
```

- [ ] **Step 2: 실패하는 로그 화면 테스트 작성**

`tests/renderer/fake/log-view.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createLogView } from '../../../src/renderer/fake/log-view'

function fakeScrollBox(element: HTMLElement, box: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => box.scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => box.clientHeight })
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: box.scrollTop })
}

describe('가짜 세션 화면', () => {
  it('줄을 추가하면 역할별 색 클래스로 표시한다', () => {
    const container = document.createElement('div')
    createLogView(container).appendLine([
      { text: '● ', role: 'toolBullet' },
      { text: 'Read', role: 'toolName' },
    ])
    const spans = container.querySelectorAll('.log-line span')
    expect([...spans].map((span) => span.className)).toEqual(['role-toolBullet', 'role-toolName'])
    expect(container.textContent).toBe('● Read')
  })

  it('마지막 줄을 고쳐 쓰면 줄 수는 그대로이고 내용만 바뀐다', () => {
    const container = document.createElement('div')
    const view = createLogView(container)
    view.appendLine([{ text: '✢ Thinking… (0s)', role: 'thinking' }])
    view.replaceLastLine([{ text: '✳ Thinking… (1s)', role: 'thinking' }])
    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('✳ Thinking… (1s)')
  })

  it('최대 줄 수를 넘으면 오래된 줄부터 지운다', () => {
    const container = document.createElement('div')
    const view = createLogView(container, { maxLines: 3 })
    for (const text of ['1', '2', '3', '4', '5']) view.appendLine([{ text, role: 'result' }])
    expect([...container.children].map((line) => line.textContent)).toEqual(['3', '4', '5'])
  })

  it('맨 아래를 보고 있으면 새 줄이 올 때 따라 내려간다', () => {
    const container = document.createElement('div')
    fakeScrollBox(container, { scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    createLogView(container).appendLine([{ text: 'new', role: 'result' }])
    expect(container.scrollTop).toBe(1000)
  })

  it('위로 스크롤해서 보고 있으면 새 줄이 와도 스크롤을 옮기지 않는다', () => {
    const container = document.createElement('div')
    fakeScrollBox(container, { scrollHeight: 1000, clientHeight: 200, scrollTop: 100 })
    createLogView(container).appendLine([{ text: 'new', role: 'result' }])
    expect(container.scrollTop).toBe(100)
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/fake/player.test.ts tests/renderer/fake/log-view.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 4: 출력기 구현**

`src/renderer/fake/player.ts`:
```ts
import type { FakeEvent, LogSegment, LogSink } from './events'

export const SPINNER_FRAME_MS = 250
const SPINNER_GLYPHS = ['✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳']
const TYPE_OUT_FINAL_PAUSE_MS = 400
const SPINNER_RESULT_PAUSE_MS = 200

type Step = { render(sink: LogSink): void; waitMs: number }

export type Player = {
  start(): void
  pause(): void
  resume(): void
  isPaused(): boolean
}

export type PlayerOptions = {
  nextEvent: () => FakeEvent
  sink: LogSink
  delayMultiplier: () => number
}

export function createPlayer({ nextEvent, sink, delayMultiplier }: PlayerOptions): Player {
  let pendingSteps: Step[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let paused = false

  function playNextStep(): void {
    timer = null
    if (pendingSteps.length === 0) pendingSteps = stepsFor(nextEvent())
    const step = pendingSteps.shift()!
    step.render(sink)
    timer = setTimeout(playNextStep, step.waitMs * delayMultiplier())
  }

  return {
    start() {
      if (started) return
      started = true
      if (!paused) playNextStep()
    },
    pause() {
      paused = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    resume() {
      if (!paused) return
      paused = false
      if (started) playNextStep()
    },
    isPaused: () => paused,
  }
}

function stepsFor(event: FakeEvent): Step[] {
  switch (event.kind) {
    case 'line':
      return [{ render: (sink) => sink.appendLine(event.segments), waitMs: event.delayMs }]
    case 'typeOut':
      return typeOutSteps(event)
    case 'spinner':
      return spinnerSteps(event)
  }
}

function typeOutSteps({ text, role, charDelayMs }: Extract<FakeEvent, { kind: 'typeOut' }>): Step[] {
  const steps: Step[] = [{ render: (sink) => sink.appendLine([{ text: '', role }]), waitMs: charDelayMs }]
  for (let length = 1; length <= text.length; length++) {
    const segments: LogSegment[] = [{ text: text.slice(0, length), role }]
    const isLast = length === text.length
    steps.push({ render: (sink) => sink.replaceLastLine(segments), waitMs: isLast ? TYPE_OUT_FINAL_PAUSE_MS : charDelayMs })
  }
  return steps
}

function spinnerSteps({ label, durationMs }: Extract<FakeEvent, { kind: 'spinner' }>): Step[] {
  const frameCount = Math.max(1, Math.ceil(durationMs / SPINNER_FRAME_MS))
  const steps: Step[] = []
  for (let frame = 0; frame < frameCount; frame++) {
    const elapsedSeconds = Math.floor((frame * SPINNER_FRAME_MS) / 1000)
    const glyph = SPINNER_GLYPHS[frame % SPINNER_GLYPHS.length]
    const segments: LogSegment[] = [
      { text: `${glyph} ${label}… (${elapsedSeconds}s · esc to interrupt)`, role: 'thinking' },
    ]
    steps.push({
      render: (sink) => (frame === 0 ? sink.appendLine(segments) : sink.replaceLastLine(segments)),
      waitMs: SPINNER_FRAME_MS,
    })
  }
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  steps.push({
    render: (sink) => sink.replaceLastLine([{ text: `✻ ${label} for ${totalSeconds}s`, role: 'muted' }]),
    waitMs: SPINNER_RESULT_PAUSE_MS,
  })
  return steps
}
```

- [ ] **Step 5: 로그 화면 구현**

`src/renderer/fake/log-view.ts`:
```ts
import type { LogSegment, LogSink } from './events'

export const MAX_LOG_LINES = 3000
const BOTTOM_TOLERANCE_PX = 4

export function createLogView(container: HTMLElement, { maxLines = MAX_LOG_LINES } = {}): LogSink {
  const doc = container.ownerDocument

  function renderSegments(lineElement: Element, segments: LogSegment[]): void {
    lineElement.replaceChildren(
      ...segments.map((segment) => {
        const span = doc.createElement('span')
        span.className = `role-${segment.role}`
        span.textContent = segment.text
        return span
      }),
    )
  }

  function isScrolledToBottom(): boolean {
    return container.scrollTop + container.clientHeight >= container.scrollHeight - BOTTOM_TOLERANCE_PX
  }

  function followIfWasAtBottom(wasAtBottom: boolean): void {
    if (wasAtBottom) container.scrollTop = container.scrollHeight
  }

  function appendLine(segments: LogSegment[]): void {
    const wasAtBottom = isScrolledToBottom()
    const lineElement = doc.createElement('div')
    lineElement.className = 'log-line'
    renderSegments(lineElement, segments)
    container.append(lineElement)
    while (container.childElementCount > maxLines) container.firstElementChild?.remove()
    followIfWasAtBottom(wasAtBottom)
  }

  function replaceLastLine(segments: LogSegment[]): void {
    const lastLine = container.lastElementChild
    if (!lastLine) {
      appendLine(segments)
      return
    }
    const wasAtBottom = isScrolledToBottom()
    renderSegments(lastLine, segments)
    followIfWasAtBottom(wasAtBottom)
  }

  return { appendLine, replaceLastLine }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/fake/player.test.ts tests/renderer/fake/log-view.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/fake/player.ts src/renderer/fake/log-view.ts tests/renderer/fake/player.test.ts tests/renderer/fake/log-view.test.ts
git commit -m "feat: 가짜 세션 출력기와 로그 화면 추가

출력기는 화면을 모르고 LogSink에만 쓴다. 로그 화면은 최대 3000줄을
유지하고, 사용자가 위로 스크롤해 둔 동안에는 자동 스크롤을 멈춘다."
```

---

### Task 13: 분할 크기 조절과 패닉 접기

**Files:**
- Create: `src/renderer/split-layout.ts`, `src/renderer/splitter.ts`
- Test: `tests/renderer/split-layout.test.ts`, `tests/renderer/splitter.test.ts`

**Interfaces:**
- Produces:
  - `split-layout.ts`: `MIN_PANE_PX = 80`, `PANIC_RATIO = 1`, `clampTopPaneHeight(desiredTopPx: number, availablePx: number, minPanePx?: number): number`, `ratioFromPointer(pointerOffsetPx: number, availablePx: number, minPanePx?: number): number`, `type PanicToggle = { toggle(currentRatio: number): number; isPanicked(): boolean }`, `createPanicToggle(): PanicToggle`
  - `splitter.ts`: `SPLIT_HANDLE_PX = 6`, `type Splitter = { setRatio(ratio: number): void; getRatio(): number }`, `createSplitter(options: { container: HTMLElement; handle: HTMLElement; initialRatio: number; onRatioCommitted(ratio: number): void }): Splitter` — 비율은 컨테이너의 CSS 변수 `--split-ratio`에 쓴다 (위 영역이 차지하는 비율)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/renderer/split-layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { PANIC_RATIO, clampTopPaneHeight, createPanicToggle, ratioFromPointer } from '../../src/renderer/split-layout'

describe('분할 크기 계산', () => {
  it('끌어 놓은 위치의 비율로 나눈다', () => {
    expect(ratioFromPointer(300, 600)).toBe(0.5)
  })

  it('위 영역은 최소 80px보다 작아지지 않는다', () => {
    expect(clampTopPaneHeight(10, 600)).toBe(80)
  })

  it('아래 영역도 최소 80px보다 작아지지 않는다', () => {
    expect(clampTopPaneHeight(590, 600)).toBe(520)
  })

  it('창이 최소 크기 두 배보다 작으면 반씩 나눈다', () => {
    expect(clampTopPaneHeight(10, 120)).toBe(60)
  })

  it('높이를 알 수 없으면 반씩 나눈다', () => {
    expect(ratioFromPointer(100, 0)).toBe(0.5)
  })
})

describe('패닉 접기', () => {
  it('누르면 에디터를 접고 가짜 세션이 전체를 차지한다', () => {
    const panic = createPanicToggle()
    expect(panic.toggle(0.55)).toBe(PANIC_RATIO)
    expect(panic.isPanicked()).toBe(true)
  })

  it('다시 누르면 원래 비율로 되돌린다', () => {
    const panic = createPanicToggle()
    panic.toggle(0.42)
    expect(panic.toggle(PANIC_RATIO)).toBe(0.42)
    expect(panic.isPanicked()).toBe(false)
  })
})
```

`tests/renderer/splitter.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { SPLIT_HANDLE_PX, createSplitter } from '../../src/renderer/splitter'

function setup(initialRatio = 0.55) {
  const container = document.createElement('div')
  const handle = document.createElement('div')
  container.append(handle)
  container.getBoundingClientRect = () => ({ top: 0, height: 400 + SPLIT_HANDLE_PX }) as DOMRect
  const committed: number[] = []
  const splitter = createSplitter({ container, handle, initialRatio, onRatioCommitted: (ratio) => committed.push(ratio) })
  return { container, handle, splitter, committed }
}

describe('분할 막대', () => {
  it('처음 비율을 화면에 적용한다', () => {
    const { container, splitter } = setup(0.55)
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.55')
    expect(splitter.getRatio()).toBe(0.55)
  })

  it('막대를 끌면 위아래 비율이 바뀌고 놓으면 바뀐 비율을 알린다', () => {
    const { container, handle, committed } = setup()
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 200 }))
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.5')
    handle.dispatchEvent(new MouseEvent('pointerup', { clientY: 200 }))
    expect(committed).toEqual([0.5])
  })

  it('놓은 뒤에는 움직여도 비율이 바뀌지 않는다', () => {
    const { container, handle } = setup()
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointerup', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 100 }))
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.55')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/split-layout.test.ts tests/renderer/splitter.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/renderer/split-layout.ts`:
```ts
export const MIN_PANE_PX = 80
export const PANIC_RATIO = 1

export function clampTopPaneHeight(desiredTopPx: number, availablePx: number, minPanePx = MIN_PANE_PX): number {
  if (availablePx < minPanePx * 2) return availablePx / 2
  return Math.min(availablePx - minPanePx, Math.max(minPanePx, desiredTopPx))
}

export function ratioFromPointer(pointerOffsetPx: number, availablePx: number, minPanePx = MIN_PANE_PX): number {
  if (availablePx <= 0) return 0.5
  return clampTopPaneHeight(pointerOffsetPx, availablePx, minPanePx) / availablePx
}

export type PanicToggle = {
  toggle(currentRatio: number): number
  isPanicked(): boolean
}

export function createPanicToggle(): PanicToggle {
  let ratioBeforePanic: number | null = null
  return {
    toggle(currentRatio) {
      if (ratioBeforePanic === null) {
        ratioBeforePanic = currentRatio
        return PANIC_RATIO
      }
      const restored = ratioBeforePanic
      ratioBeforePanic = null
      return restored
    },
    isPanicked: () => ratioBeforePanic !== null,
  }
}
```

`src/renderer/splitter.ts`:
```ts
import { ratioFromPointer } from './split-layout'

export const SPLIT_HANDLE_PX = 6

export type Splitter = {
  setRatio(ratio: number): void
  getRatio(): number
}

export type SplitterOptions = {
  container: HTMLElement
  handle: HTMLElement
  initialRatio: number
  onRatioCommitted(ratio: number): void
}

export function createSplitter({ container, handle, initialRatio, onRatioCommitted }: SplitterOptions): Splitter {
  let ratio = initialRatio

  function setRatio(next: number): void {
    ratio = next
    container.style.setProperty('--split-ratio', String(next))
  }

  function ratioAt(clientY: number): number {
    const rect = container.getBoundingClientRect()
    return ratioFromPointer(clientY - rect.top, rect.height - SPLIT_HANDLE_PX)
  }

  handle.addEventListener('pointerdown', (downEvent) => {
    downEvent.preventDefault()
    handle.setPointerCapture?.(downEvent.pointerId)
    const onMove = (moveEvent: PointerEvent) => setRatio(ratioAt(moveEvent.clientY))
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      onRatioCommitted(ratio)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  })

  setRatio(initialRatio)
  return { setRatio, getRatio: () => ratio }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/split-layout.test.ts tests/renderer/splitter.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/split-layout.ts src/renderer/splitter.ts tests/renderer/split-layout.test.ts tests/renderer/splitter.test.ts
git commit -m "feat: 분할 막대 드래그와 패닉 접기 추가

드래그할 때 위아래 영역은 최소 80px을 유지하고, 패닉 키로 접을 때만
에디터가 0이 된다. 다시 누르면 접기 전 비율로 돌아간다."
```

---

### Task 14: 글쓰기 에디터

**Files:**
- Create: `src/renderer/editor.ts`, `tests/setup-dom.ts`
- Modify: `vitest.config.ts` (setupFiles 추가)
- Test: `tests/renderer/editor.test.ts`

**Interfaces:**
- Produces:
  - `type CursorPosition = { line: number; column: number }`
  - `type Editor = { getText(): string; setText(text: string): void; setSyntaxHighlight(enabled: boolean): void; focus(): void }`
  - `createEditor(options: { parent: HTMLElement; initialText: string; syntaxHighlight: boolean; onTextChanged(text: string): void; onCursorMoved(position: CursorPosition): void; onUserTyped(): void }): Editor`
  - `setText`는 되돌리기 기록을 비우고, `onTextChanged`와 `onCursorMoved`를 직접 한 번 부른다. 프로그램이 바꾼 글은 `onUserTyped`를 부르지 않는다.
  - 색은 테마 CSS 변수(`--color-md-*`)를 쓴다.

- [ ] **Step 1: jsdom 보완 파일 작성과 설정 연결**

jsdom에는 화면 배치 계산이 없어서 CodeMirror가 쓰는 `Range.getClientRects`가 없다.

`tests/setup-dom.ts`:
```ts
if (typeof Range !== 'undefined') {
  const emptyRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => emptyRect as DOMRect
}
```

`vitest.config.ts` (전체 교체):
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-dom.ts'],
  },
})
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/renderer/editor.test.ts`:
```ts
// @vitest-environment jsdom
import { undoDepth } from '@codemirror/commands'
import { language } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createEditor, type CursorPosition } from '../../src/renderer/editor'

function setup(initialText = '# 제목') {
  const parent = document.createElement('div')
  document.body.append(parent)
  const changedTexts: string[] = []
  const cursorPositions: CursorPosition[] = []
  let typedCount = 0
  const editor = createEditor({
    parent,
    initialText,
    syntaxHighlight: true,
    onTextChanged: (text) => changedTexts.push(text),
    onCursorMoved: (position) => cursorPositions.push(position),
    onUserTyped: () => typedCount++,
  })
  const view = () => EditorView.findFromDOM(parent.querySelector('.cm-editor') as HTMLElement)!
  return { editor, view, changedTexts, cursorPositions, typedCount: () => typedCount }
}

describe('글쓰기 에디터', () => {
  it('처음 받은 글을 보여 준다', () => {
    expect(setup('# 회의록').editor.getText()).toBe('# 회의록')
  })

  it('글을 통째로 바꾸면 바뀐 글을 알린다', () => {
    const { editor, changedTexts } = setup()
    editor.setText('새 글')
    expect(editor.getText()).toBe('새 글')
    expect(changedTexts.at(-1)).toBe('새 글')
  })

  it('새 글로 바꾸면 되돌리기 기록이 비워진다', () => {
    const { editor, view } = setup()
    view().dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' })
    expect(undoDepth(view().state)).toBeGreaterThan(0)
    editor.setText('다른 파일')
    expect(undoDepth(view().state)).toBe(0)
  })

  it('사용자가 입력하면 입력했다고 알린다', () => {
    const { view, typedCount, changedTexts } = setup('')
    view().dispatch({ changes: { from: 0, insert: '가' }, userEvent: 'input.type' })
    expect(typedCount()).toBe(1)
    expect(changedTexts.at(-1)).toBe('가')
  })

  it('프로그램이 글을 바꾼 것은 입력으로 치지 않는다', () => {
    const { editor, typedCount } = setup()
    editor.setText('불러온 글')
    expect(typedCount()).toBe(0)
  })

  it('커서를 옮기면 줄과 칸 위치를 알린다', () => {
    const { editor, view, cursorPositions } = setup()
    editor.setText('ab\ncd')
    view().dispatch({ selection: { anchor: 4 } })
    expect(cursorPositions.at(-1)).toEqual({ line: 2, column: 2 })
  })

  it('문법 색칠을 끄면 마크다운으로 해석하지 않고 다시 켜면 해석한다', () => {
    const { editor, view } = setup()
    expect(view().state.facet(language)).not.toBeNull()
    editor.setSyntaxHighlight(false)
    expect(view().state.facet(language)).toBeNull()
    editor.setSyntaxHighlight(true)
    expect(view().state.facet(language)).not.toBeNull()
  })

  it('글을 바꿔도 문법 색칠 설정은 유지된다', () => {
    const { editor, view } = setup()
    editor.setSyntaxHighlight(false)
    editor.setText('# 다른 글')
    expect(view().state.facet(language)).toBeNull()
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/editor.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 4: 구현**

`src/renderer/editor.ts`:
```ts
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export type CursorPosition = { line: number; column: number }

export type Editor = {
  getText(): string
  setText(text: string): void
  setSyntaxHighlight(enabled: boolean): void
  focus(): void
}

export type EditorOptions = {
  parent: HTMLElement
  initialText: string
  syntaxHighlight: boolean
  onTextChanged(text: string): void
  onCursorMoved(position: CursorPosition): void
  onUserTyped(): void
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-md-heading)', fontWeight: 'bold' },
  { tag: tags.strong, color: 'var(--color-md-strong)', fontWeight: 'bold' },
  { tag: tags.emphasis, color: 'var(--color-md-emphasis)', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--color-md-code)' },
  { tag: [tags.link, tags.url], color: 'var(--color-md-link)' },
  { tag: tags.quote, color: 'var(--color-md-quote)' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: 'var(--color-md-meta)' },
  { tag: [tags.keyword, tags.operatorKeyword], color: 'var(--color-md-link)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-md-code)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-md-emphasis)' },
  { tag: tags.comment, color: 'var(--color-md-quote)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.typeName, tags.className], color: 'var(--color-md-strong)' },
])

function highlightExtensions(enabled: boolean): Extension {
  if (!enabled) return []
  return [markdown({ base: markdownLanguage, codeLanguages: languages }), syntaxHighlighting(markdownHighlightStyle)]
}

function cursorPosition(state: EditorState): CursorPosition {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  return { line: line.number, column: head - line.from + 1 }
}

export function createEditor(options: EditorOptions): Editor {
  const highlightCompartment = new Compartment()
  let syntaxHighlightEnabled = options.syntaxHighlight

  const notifyChanges = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.onTextChanged(update.state.doc.toString())
      const typedByUser = update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
      if (typedByUser) options.onUserTyped()
    }
    if (update.docChanged || update.selectionSet) options.onCursorMoved(cursorPosition(update.state))
  })

  const createState = (text: string) =>
    EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        highlightCompartment.of(highlightExtensions(syntaxHighlightEnabled)),
        notifyChanges,
      ],
    })

  const view = new EditorView({ parent: options.parent, state: createState(options.initialText) })

  return {
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.setState(createState(text))
      options.onTextChanged(text)
      options.onCursorMoved(cursorPosition(view.state))
    },
    setSyntaxHighlight(enabled) {
      syntaxHighlightEnabled = enabled
      view.dispatch({ effects: highlightCompartment.reconfigure(highlightExtensions(enabled)) })
    },
    focus: () => view.focus(),
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/editor.test.ts`
Expected: PASS (8 tests)

Run: `npm test`
Expected: 전체 PASS (setup 파일이 node 환경 테스트에 영향이 없는지 확인)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/editor.ts tests/setup-dom.ts tests/renderer/editor.test.ts vitest.config.ts
git commit -m "feat: CodeMirror 마크다운 에디터 추가

문법 색칠은 켜고 끌 수 있고, 새 글을 불러오면 되돌리기 기록을 비운다.
사용자 입력과 프로그램이 바꾼 글을 구분해서 알린다."
```

---

### Task 15: 문서 상태, 문서 명령, 자동 백업

**Files:**
- Create: `src/renderer/document-state.ts`, `src/renderer/document-commands.ts`, `src/renderer/autosave.ts`
- Test: `tests/renderer/document-state.test.ts`, `tests/renderer/document-commands.test.ts`, `tests/renderer/autosave.test.ts`

**Interfaces:**
- Consumes: `OpenedFile`, `ImworkingApi` (Task 7), `Backup`, `Eol`, `FileFormat`, `SourceEncoding` (Task 1)
- Produces:
  - `document-state.ts`: `type DocumentInfo = { path: string | null; eol: Eol; encoding: SourceEncoding; format: FileFormat | null }`, `type DocumentState`, `createDocumentState(newDocumentEol: Eol): DocumentState` — 메서드: `info()`, `fileName()`, `isDirty(currentText)`, `startNew()`, `loadFromFile(file)`, `loadUnsaved(backup)`, `markSaved(saved, text)`, `toBackup(currentText, savedAt)`
  - `document-commands.ts`: `type TextSource = { getText(): string; setText(text: string): void }`, `type FileLocation = { path: string; directory: string; format: FileFormat; origin: 'opened' | 'saved' }`, `type CommandsApi`, `type DocumentCommands = { newDocument(): Promise<boolean>; open(): Promise<boolean>; save(): Promise<boolean>; saveAs(): Promise<boolean>; close(): Promise<boolean>; openPath(path: string): Promise<boolean>; restoreBackup(backup: Backup): void }`, `createDocumentCommands(deps): DocumentCommands`
  - `autosave.ts`: `AUTOSAVE_INTERVAL_MS = 30_000`, `type Autosave = { start(): void; stop(): void; forgetLastBackup(): void }`, `createAutosave(options: { intervalMs?: number; takeSnapshot(): Backup | null; writeBackup(backup: Backup): Promise<void> }): Autosave`

- [ ] **Step 1: 문서 상태 테스트 작성**

`tests/renderer/document-state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createDocumentState } from '../../src/renderer/document-state'
import type { OpenedFile } from '../../src/shared/api'

const openedFile: OpenedFile = {
  path: 'C:\\notes\\회의록.md',
  directory: 'C:\\notes',
  text: '# 회의록',
  eol: 'crlf',
  encoding: 'cp949',
  format: 'md',
}

describe('문서 변경 여부', () => {
  it('새 문서에 아무것도 안 썼으면 변경이 없다', () => {
    expect(createDocumentState('lf').isDirty('')).toBe(false)
  })

  it('불러온 내용과 다르면 변경이 있다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.isDirty('# 회의록 수정')).toBe(true)
  })

  it('고쳤다가 원래대로 되돌리면 변경이 없다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.isDirty('# 회의록')).toBe(false)
  })

  it('저장하면 그 내용이 새 기준이 되고 인코딩은 UTF-8이 된다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    state.markSaved({ path: 'C:\\notes\\회의록.md', format: 'md' }, '# 저장한 글')
    expect(state.isDirty('# 저장한 글')).toBe(false)
    expect(state.info().encoding).toBe('utf-8')
  })

  it('백업에서 복구한 문서는 저장하기 전까지 변경이 있다', () => {
    const state = createDocumentState('lf')
    state.loadUnsaved({ path: null, content: '복구한 글', eol: 'lf', savedAt: '2026-10-08T00:00:00.000Z' })
    expect(state.isDirty('복구한 글')).toBe(true)
  })

  it('새 문서를 시작하면 경로와 줄바꿈이 기본값으로 돌아간다', () => {
    const state = createDocumentState('crlf')
    state.loadFromFile({ ...openedFile, eol: 'lf' })
    state.startNew()
    expect(state.info()).toEqual({ path: null, eol: 'crlf', encoding: 'utf-8', format: null })
  })
})

describe('문서 이름', () => {
  it('파일 이름은 윈도우 경로와 맥 경로 모두 마지막 부분이다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.fileName()).toBe('회의록.md')
    state.loadFromFile({ ...openedFile, path: '/Users/me/notes/todo.txt' })
    expect(state.fileName()).toBe('todo.txt')
  })

  it('새 문서는 파일 이름이 없다', () => {
    expect(createDocumentState('lf').fileName()).toBeNull()
  })
})

describe('백업 스냅샷', () => {
  it('변경이 없으면 백업할 내용이 없다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.toBackup('# 회의록', '2026-10-08T00:00:00.000Z')).toBeNull()
  })

  it('새 문서에 아무것도 안 썼으면 백업하지 않는다', () => {
    expect(createDocumentState('lf').toBackup('', '2026-10-08T00:00:00.000Z')).toBeNull()
  })

  it('변경이 있으면 경로, 내용, 줄바꿈, 시각을 백업한다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.toBackup('# 고친 글', '2026-10-08T00:00:00.000Z')).toEqual({
      path: 'C:\\notes\\회의록.md',
      content: '# 고친 글',
      eol: 'crlf',
      savedAt: '2026-10-08T00:00:00.000Z',
    })
  })
})
```

- [ ] **Step 2: 문서 명령 테스트 작성**

`tests/renderer/document-commands.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
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

function createFakeApi(overrides: Partial<CommandsApi> = {}) {
  const calls: string[] = []
  const api: CommandsApi = {
    openFileDialog: async () => {
      calls.push('openFileDialog')
      return { status: 'opened', file: openedFile }
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
    clearBackup: async () => {
      calls.push('clearBackup')
    },
    closeWindowNow: () => {
      calls.push('closeWindowNow')
    },
    ...overrides,
  }
  return { api, calls }
}

function setup(api: CommandsApi) {
  let text = ''
  const editor = { getText: () => text, setText: (next: string) => (text = next) }
  const documentState = createDocumentState('lf')
  const locations: (FileLocation | null)[] = []
  const commands = createDocumentCommands({
    api,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: '/notes', defaultFormat: 'md' }),
    onFileLocationChanged: (location) => locations.push(location),
    onDocumentReplaced: () => undefined,
  })
  return { commands, documentState, locations, type: (next: string) => (text = next), text: () => text }
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

  it('새 문서를 열면 열린 파일이 없다고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, locations } = setup(api)
    await commands.newDocument()
    expect(locations.at(-1)).toBeNull()
  })
})

describe('저장', () => {
  it('저장하면 고른 경로와 형식을 알리고 백업을 지운다', async () => {
    const { api, calls } = createFakeApi()
    const { commands, type, locations } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(true)
    expect(locations.at(-1)).toEqual({ path: '/notes/new.md', directory: '/notes', format: 'md', origin: 'saved' })
    expect(calls).toContain('clearBackup')
  })

  it('저장하고 나면 변경 없음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, type, documentState } = setup(api)
    type('새 글')
    await commands.save()
    expect(documentState.isDirty('새 글')).toBe(false)
  })

  it('저장에 실패하면 변경 상태를 그대로 둔다', async () => {
    const { api } = createFakeApi({ saveFile: async () => ({ status: 'failed', message: '권한' }) })
    const { commands, type, documentState } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(false)
    expect(documentState.isDirty('새 글')).toBe(true)
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

describe('열기와 복구', () => {
  it('파일을 열면 에디터에 내용을 넣고 변경 없음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState, locations } = setup(api)
    expect(await commands.open()).toBe(true)
    expect(text()).toBe('# 열린 글')
    expect(documentState.isDirty('# 열린 글')).toBe(false)
    expect(locations.at(-1)).toMatchObject({ path: '/notes/a.md', origin: 'opened' })
  })

  it('마지막 파일 다시 열기에 실패하면 새 문서 그대로 둔다', async () => {
    const { api } = createFakeApi()
    const { commands, text } = setup(api)
    expect(await commands.openPath('/notes/gone.md')).toBe(false)
    expect(text()).toBe('')
  })

  it('백업에서 복구하면 내용을 넣고 변경 있음 상태가 된다', () => {
    const { api } = createFakeApi()
    const { commands, text, documentState } = setup(api)
    commands.restoreBackup({ path: null, content: '복구한 글', eol: 'lf', savedAt: '2026-10-08T00:00:00.000Z' })
    expect(text()).toBe('복구한 글')
    expect(documentState.isDirty('복구한 글')).toBe(true)
  })
})

describe('닫기', () => {
  it('변경 없이 닫으면 백업을 지우고 창을 닫는다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    expect(await commands.close()).toBe(true)
    expect(calls).toEqual(['clearBackup', 'closeWindowNow'])
  })

  it('닫을 때 저장을 골랐는데 저장 창을 취소하면 닫지 않는다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'save', saveFile: async () => ({ status: 'canceled' }) })
    const { commands, type } = setup(api)
    type('잃으면 안 되는 글')
    expect(await commands.close()).toBe(false)
    expect(calls).not.toContain('closeWindowNow')
  })
})
```

- [ ] **Step 3: 자동 백업 테스트 작성**

`tests/renderer/autosave.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_INTERVAL_MS, createAutosave } from '../../src/renderer/autosave'
import type { Backup } from '../../src/shared/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const backupOf = (content: string): Backup => ({ path: null, content, eol: 'lf', savedAt: '2026-10-08T00:00:00.000Z' })

function setup(initialSnapshot: Backup | null) {
  let snapshot = initialSnapshot
  const written: string[] = []
  let failNextWrite = false
  const autosave = createAutosave({
    takeSnapshot: () => snapshot,
    writeBackup: async (backup) => {
      if (failNextWrite) {
        failNextWrite = false
        throw new Error('disk')
      }
      written.push(backup.content)
    },
  })
  return {
    autosave,
    written,
    setSnapshot: (next: Backup | null) => (snapshot = next),
    failNextWrite: () => (failNextWrite = true),
  }
}

describe('자동 백업', () => {
  it('30초마다 백업할 내용이 있으면 백업한다', async () => {
    const { autosave, written } = setup(backupOf('쓰는 중'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1)
    expect(written).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(written).toEqual(['쓰는 중'])
  })

  it('백업할 내용이 없으면 백업하지 않는다', async () => {
    const { autosave, written } = setup(null)
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(written).toEqual([])
  })

  it('지난 백업과 내용이 같으면 다시 백업하지 않는다', async () => {
    const { autosave, written } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(written).toEqual(['같은 글'])
  })

  it('내용이 바뀌면 다음 주기에 다시 백업한다', async () => {
    const { autosave, written, setSnapshot } = setup(backupOf('첫 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(backupOf('고친 글'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(written).toEqual(['첫 글', '고친 글'])
  })

  it('지난 백업을 잊은 뒤에는 같은 내용이라도 다시 백업한다', async () => {
    const { autosave, written } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    autosave.forgetLastBackup()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(written).toEqual(['같은 글', '같은 글'])
  })

  it('백업에 실패하면 다음 주기에 다시 시도한다', async () => {
    const { autosave, written, failNextWrite } = setup(backupOf('글'))
    failNextWrite()
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(written).toEqual(['글'])
  })

  it('멈추면 더 이상 백업하지 않는다', async () => {
    const { autosave, written } = setup(backupOf('글'))
    autosave.start()
    autosave.stop()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(written).toEqual([])
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/document-state.test.ts tests/renderer/document-commands.test.ts tests/renderer/autosave.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 5: 문서 상태 구현**

`src/renderer/document-state.ts`:
```ts
import type { OpenedFile } from '../shared/api'
import type { Backup, Eol, FileFormat, SourceEncoding } from '../shared/types'

export type DocumentInfo = {
  path: string | null
  eol: Eol
  encoding: SourceEncoding
  format: FileFormat | null
}

export type DocumentState = {
  info(): DocumentInfo
  fileName(): string | null
  isDirty(currentText: string): boolean
  startNew(): void
  loadFromFile(file: OpenedFile): void
  loadUnsaved(backup: Backup): void
  markSaved(saved: { path: string; format: FileFormat }, savedText: string): void
  toBackup(currentText: string, savedAt: string): Backup | null
}

export function createDocumentState(newDocumentEol: Eol): DocumentState {
  const blankInfo = (): DocumentInfo => ({ path: null, eol: newDocumentEol, encoding: 'utf-8', format: null })
  let info = blankInfo()
  // null이면 디스크에 저장된 적 없는 복구 내용이라 항상 변경 있음으로 본다.
  let savedText: string | null = ''

  const isDirty = (currentText: string) => savedText === null || currentText !== savedText

  return {
    info: () => ({ ...info }),
    fileName: () => (info.path ? (info.path.split(/[\\/]/).pop() ?? info.path) : null),
    isDirty,
    startNew() {
      info = blankInfo()
      savedText = ''
    },
    loadFromFile(file) {
      info = { path: file.path, eol: file.eol, encoding: file.encoding, format: file.format }
      savedText = file.text
    },
    loadUnsaved(backup) {
      info = { ...blankInfo(), path: backup.path, eol: backup.eol }
      savedText = null
    },
    markSaved(saved, text) {
      info = { ...info, path: saved.path, format: saved.format, encoding: 'utf-8' }
      savedText = text
    },
    toBackup(currentText, savedAt) {
      if (!isDirty(currentText)) return null
      return { path: info.path, content: currentText, eol: info.eol, savedAt }
    },
  }
}
```

- [ ] **Step 6: 문서 명령 구현**

`src/renderer/document-commands.ts`:
```ts
import type { ImworkingApi, OpenedFile } from '../shared/api'
import type { Backup, FileFormat } from '../shared/types'
import type { DocumentState } from './document-state'

export type TextSource = { getText(): string; setText(text: string): void }

export type FileLocation = { path: string; directory: string; format: FileFormat; origin: 'opened' | 'saved' }

export type CommandsApi = Pick<
  ImworkingApi,
  'openFileDialog' | 'openPath' | 'saveFile' | 'confirmDiscard' | 'clearBackup' | 'closeWindowNow'
>

export type DocumentCommandsDeps = {
  api: CommandsApi
  editor: TextSource
  documentState: DocumentState
  savePreferences(): { defaultDirectory: string | null; defaultFormat: FileFormat }
  onFileLocationChanged(location: FileLocation | null): void
  onDocumentReplaced(): void
}

export type DocumentCommands = {
  newDocument(): Promise<boolean>
  open(): Promise<boolean>
  save(): Promise<boolean>
  saveAs(): Promise<boolean>
  close(): Promise<boolean>
  openPath(path: string): Promise<boolean>
  restoreBackup(backup: Backup): void
}

export function createDocumentCommands(deps: DocumentCommandsDeps): DocumentCommands {
  const { api, editor, documentState } = deps

  async function saveDocument(saveAs: boolean): Promise<boolean> {
    const text = editor.getText()
    const { path, eol } = documentState.info()
    const { defaultDirectory, defaultFormat } = deps.savePreferences()
    const result = await api.saveFile({ path, text, eol, saveAs, defaultDirectory, defaultFormat })
    if (result.status !== 'saved') return false
    documentState.markSaved({ path: result.path, format: result.format }, text)
    await api.clearBackup()
    deps.onFileLocationChanged({ path: result.path, directory: result.directory, format: result.format, origin: 'saved' })
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

  return {
    async newDocument() {
      if (!(await resolveUnsavedChanges())) return false
      documentState.startNew()
      editor.setText('')
      await api.clearBackup()
      deps.onDocumentReplaced()
      deps.onFileLocationChanged(null)
      return true
    },

    async open() {
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openFileDialog(deps.savePreferences().defaultDirectory)
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      await api.clearBackup()
      return true
    },

    save: () => saveDocument(false),

    saveAs: () => saveDocument(true),

    async close() {
      if (!(await resolveUnsavedChanges())) return false
      await api.clearBackup()
      api.closeWindowNow()
      return true
    },

    async openPath(path) {
      const result = await api.openPath(path)
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      return true
    },

    restoreBackup(backup) {
      documentState.loadUnsaved(backup)
      editor.setText(backup.content)
      deps.onDocumentReplaced()
    },
  }
}
```

- [ ] **Step 7: 자동 백업 구현**

`src/renderer/autosave.ts`:
```ts
import type { Backup } from '../shared/types'

export const AUTOSAVE_INTERVAL_MS = 30_000

export type Autosave = {
  start(): void
  stop(): void
  forgetLastBackup(): void
}

export type AutosaveOptions = {
  intervalMs?: number
  takeSnapshot(): Backup | null
  writeBackup(backup: Backup): Promise<void>
}

export function createAutosave({ intervalMs = AUTOSAVE_INTERVAL_MS, takeSnapshot, writeBackup }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setInterval> | null = null
  let lastWritten: { path: string | null; content: string } | null = null

  async function backupIfChanged(): Promise<void> {
    const snapshot = takeSnapshot()
    if (!snapshot) return
    const unchanged = lastWritten?.content === snapshot.content && lastWritten.path === snapshot.path
    if (unchanged) return
    lastWritten = { path: snapshot.path, content: snapshot.content }
    try {
      await writeBackup(snapshot)
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
    forgetLastBackup() {
      lastWritten = null
    },
  }
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/document-state.test.ts tests/renderer/document-commands.test.ts tests/renderer/autosave.test.ts`
Expected: PASS (35 tests)

- [ ] **Step 9: Commit**

```bash
git add src/renderer/document-state.ts src/renderer/document-commands.ts src/renderer/autosave.ts tests/renderer/document-state.test.ts tests/renderer/document-commands.test.ts tests/renderer/autosave.test.ts
git commit -m "feat: 문서 상태, 새 문서/열기/저장/닫기 흐름, 자동 백업 추가

저장하지 않은 변경이 있으면 새 문서, 열기, 닫기 전에 묻고, 저장 창을
취소하면 아무것도 바꾸지 않는다. 30초마다 바뀐 내용만 백업한다."
```

---

### Task 16: 단축키, 상태바, 제목줄

**Files:**
- Create: `src/renderer/shortcuts.ts`, `src/renderer/statusbar.ts`, `src/renderer/titlebar.ts`
- Test: `tests/renderer/shortcuts.test.ts`, `tests/renderer/statusbar.test.ts`, `tests/renderer/titlebar.test.ts`

**Interfaces:**
- Consumes: `SourceEncoding` (Task 1), `TitlebarStyle` (Task 9)
- Produces:
  - `shortcuts.ts`: `APP_SHORTCUTS`, `type KeyPress`, `parseShortcut(combo: string): ParsedShortcut | null`, `matchesShortcut(press: KeyPress, combo: string, platform: string): boolean`, `displayShortcut(combo: string, platform: string): string`, `type ShortcutBinding = { combo(): string | null; run(): void }`, `bindShortcuts(target: EventTarget, bindings: ShortcutBinding[], platform: string): () => void` — 조합 문자열은 `Mod+Shift+S` 형식, `Mod`는 Windows에서 Ctrl, macOS에서 Cmd
  - `statusbar.ts`: `type StatusInfo`, `UNTITLED_NAME = 'untitled'`, `describeEncoding(encoding: SourceEncoding): string`, `countCharacters(text: string): number`, `formatStatus(info: StatusInfo): { left: string; right: string }`, `createStatusbar(element: HTMLElement): { update(info: StatusInfo): void }`
  - `titlebar.ts`: `type WindowActions = { minimize(): void; toggleMaximize(): void; close(): void }`, `createTitlebar(element: HTMLElement, options: { platform: string; actions: WindowActions }): { render(style: TitlebarStyle, title: string): void }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/renderer/shortcuts.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { bindShortcuts, displayShortcut, matchesShortcut, parseShortcut, type KeyPress } from '../../src/renderer/shortcuts'

const press = (overrides: Partial<KeyPress>): KeyPress => ({
  code: 'KeyS',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...overrides,
})

describe('단축키', () => {
  it('윈도우에서 Mod는 Ctrl로 동작한다', () => {
    expect(matchesShortcut(press({ ctrlKey: true }), 'Mod+S', 'win32')).toBe(true)
    expect(matchesShortcut(press({ metaKey: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('맥에서 Mod는 Cmd로 동작한다', () => {
    expect(matchesShortcut(press({ metaKey: true }), 'Mod+S', 'darwin')).toBe(true)
    expect(matchesShortcut(press({ ctrlKey: true }), 'Mod+S', 'darwin')).toBe(false)
  })

  it('조합에 없는 보조키가 눌려 있으면 반응하지 않는다', () => {
    expect(matchesShortcut(press({ ctrlKey: true, shiftKey: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('Shift+.은 키보드 배열과 상관없이 마침표 키로 인식한다', () => {
    expect(matchesShortcut(press({ code: 'Period', metaKey: true, shiftKey: true }), 'Mod+Shift+.', 'darwin')).toBe(true)
  })

  it('Ctrl+`는 백틱 키로 인식한다', () => {
    expect(matchesShortcut(press({ code: 'Backquote', ctrlKey: true }), 'Mod+`', 'win32')).toBe(true)
  })

  it('한글 조합 중에는 단축키가 반응하지 않는다', () => {
    expect(matchesShortcut(press({ ctrlKey: true, isComposing: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('알 수 없는 키나 보조키 이름은 조합으로 인정하지 않는다', () => {
    expect(parseShortcut('Mod+Foo')).toBeNull()
    expect(parseShortcut('Hyper+S')).toBeNull()
    expect(parseShortcut('')).toBeNull()
  })

  it('화면에 보여 줄 때 Mod를 OS에 맞는 키 이름으로 바꾼다', () => {
    expect(displayShortcut('Mod+Shift+.', 'darwin')).toBe('Cmd+Shift+.')
    expect(displayShortcut('Mod+`', 'win32')).toBe('Ctrl+`')
  })

  it('등록한 단축키를 누르면 동작을 실행하고 기본 동작을 막는다', () => {
    let saved = 0
    const unbind = bindShortcuts(window, [{ combo: () => 'Mod+S', run: () => saved++ }], 'win32')
    const event = new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(saved).toBe(1)
    expect(event.defaultPrevented).toBe(true)
    unbind()
  })

  it('조합이 꺼져 있으면 단축키가 반응하지 않는다', () => {
    let panicked = 0
    const unbind = bindShortcuts(window, [{ combo: () => null, run: () => panicked++ }], 'win32')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', ctrlKey: true }))
    expect(panicked).toBe(0)
    unbind()
  })
})
```

`tests/renderer/statusbar.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { countCharacters, createStatusbar, formatStatus, type StatusInfo } from '../../src/renderer/statusbar'

const status = (overrides: Partial<StatusInfo> = {}): StatusInfo => ({
  fileName: 'notes.md',
  dirty: false,
  line: 3,
  column: 1,
  characters: 128,
  encoding: 'utf-8',
  logPaused: false,
  ...overrides,
})

describe('상태바', () => {
  it('파일 이름과 저장 안 한 변경 표시를 보여 준다', () => {
    expect(formatStatus(status({ dirty: true })).left).toBe('notes.md ●')
    expect(formatStatus(status({ dirty: false })).left).toBe('notes.md')
  })

  it('새 문서는 untitled로 보여 준다', () => {
    expect(formatStatus(status({ fileName: null })).left).toBe('untitled')
  })

  it('줄, 칸, 글자수, 인코딩을 보여 준다', () => {
    expect(formatStatus(status({ characters: 1234 })).right).toBe('Ln 3, Col 1  ·  1,234자  ·  UTF-8')
  })

  it('UTF-8이 아닌 파일은 저장하면 UTF-8로 바뀐다는 것을 보여 준다', () => {
    expect(formatStatus(status({ encoding: 'cp949' })).right).toContain('CP949 → UTF-8')
  })

  it('가짜 세션이 멈춰 있으면 멈춤 표시를 보여 준다', () => {
    expect(formatStatus(status({ logPaused: true })).right).toContain('⏸ paused')
  })

  it('글자수는 줄바꿈을 세지 않고 이모지는 한 글자로 센다', () => {
    expect(countCharacters('가나\n다😀')).toBe(4)
  })

  it('상태 정보를 받으면 상태바 양쪽 글자를 바꾼다', () => {
    const element = document.createElement('footer')
    createStatusbar(element).update(status({ dirty: true }))
    expect(element.querySelector('.status-left')?.textContent).toBe('notes.md ●')
    expect(element.querySelector('.status-right')?.textContent).toContain('Ln 3, Col 1')
  })
})
```

`tests/renderer/titlebar.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTitlebar, type WindowActions } from '../../src/renderer/titlebar'

function setup(platform: string) {
  const element = document.createElement('header')
  const calls: string[] = []
  const actions: WindowActions = {
    minimize: () => calls.push('minimize'),
    toggleMaximize: () => calls.push('toggleMaximize'),
    close: () => calls.push('close'),
  }
  return { element, calls, titlebar: createTitlebar(element, { platform, actions }) }
}

describe('가짜 터미널 제목줄', () => {
  it('윈도우 테마는 탭 모양 제목과 창 버튼 세 개를 그린다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    expect(element.querySelector('.tb-tab-title')?.textContent).toBe('Windows PowerShell')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(3)
  })

  it('맥 테마는 가운데 제목을 그린다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelector('.tb-mac-title')?.textContent).toBe('user — claude — 120×40')
  })

  it('맥에서는 기본 신호등 버튼을 쓰므로 창 버튼을 그리지 않는다', () => {
    const { element, titlebar } = setup('darwin')
    titlebar.render('windows', 'Windows PowerShell')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(0)
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(0)
  })

  it('창 버튼을 누르면 해당 동작을 실행한다', () => {
    const { element, titlebar, calls } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    element.querySelector<HTMLButtonElement>('[data-action="close"]')!.click()
    element.querySelector<HTMLButtonElement>('[data-action="minimize"]')!.click()
    expect(calls).toEqual(['close', 'minimize'])
  })

  it('테마를 바꿔 다시 그리면 이전 제목줄을 지운다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelector('.tb-tab')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/shortcuts.test.ts tests/renderer/statusbar.test.ts tests/renderer/titlebar.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 단축키 구현**

`src/renderer/shortcuts.ts`:
```ts
export const APP_SHORTCUTS = {
  newDocument: 'Mod+N',
  open: 'Mod+O',
  save: 'Mod+S',
  saveAs: 'Mod+Shift+S',
  openSettings: 'Mod+,',
  toggleSyntaxHighlight: 'Mod+Shift+H',
  toggleLogPause: 'Mod+Shift+P',
  cycleTheme: 'Mod+Shift+T',
  increaseFontSize: 'Mod+=',
  decreaseFontSize: 'Mod+-',
} as const

export type KeyPress = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing'>

export type ParsedShortcut = { code: string; mod: boolean; ctrl: boolean; cmd: boolean; shift: boolean; alt: boolean }

export type ShortcutBinding = { combo(): string | null; run(): void }

const KNOWN_MODIFIERS = new Set(['mod', 'ctrl', 'cmd', 'shift', 'alt'])

// event.key는 Shift나 한글 자판에 따라 바뀌므로 물리 키 위치인 event.code로 비교한다.
const CODE_BY_SYMBOL: Record<string, string> = {
  '`': 'Backquote',
  '.': 'Period',
  ',': 'Comma',
  '=': 'Equal',
  '-': 'Minus',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
}

export function parseShortcut(combo: string): ParsedShortcut | null {
  const parts = combo.split('+').map((part) => part.trim())
  const keyName = parts.pop()
  if (!keyName) return null
  const code = codeForKeyName(keyName)
  if (!code) return null
  const modifiers = parts.map((part) => part.toLowerCase())
  if (modifiers.some((modifier) => !KNOWN_MODIFIERS.has(modifier))) return null
  return {
    code,
    mod: modifiers.includes('mod'),
    ctrl: modifiers.includes('ctrl'),
    cmd: modifiers.includes('cmd'),
    shift: modifiers.includes('shift'),
    alt: modifiers.includes('alt'),
  }
}

function codeForKeyName(keyName: string): string | null {
  if (/^[a-z]$/i.test(keyName)) return `Key${keyName.toUpperCase()}`
  if (/^[0-9]$/.test(keyName)) return `Digit${keyName}`
  return CODE_BY_SYMBOL[keyName] ?? null
}

export function matchesShortcut(press: KeyPress, combo: string, platform: string): boolean {
  if (press.isComposing) return false
  const shortcut = parseShortcut(combo)
  if (!shortcut) return false
  const isMac = platform === 'darwin'
  const wantsCtrl = shortcut.ctrl || (shortcut.mod && !isMac)
  const wantsMeta = shortcut.cmd || (shortcut.mod && isMac)
  return (
    press.code === shortcut.code &&
    press.ctrlKey === wantsCtrl &&
    press.metaKey === wantsMeta &&
    press.shiftKey === shortcut.shift &&
    press.altKey === shortcut.alt
  )
}

export function displayShortcut(combo: string, platform: string): string {
  return combo.replace(/\bMod\b/g, platform === 'darwin' ? 'Cmd' : 'Ctrl')
}

export function bindShortcuts(target: EventTarget, bindings: ShortcutBinding[], platform: string): () => void {
  const onKeyDown = (event: Event) => {
    const keyEvent = event as KeyboardEvent
    const binding = bindings.find((candidate) => {
      const combo = candidate.combo()
      return combo !== null && matchesShortcut(keyEvent, combo, platform)
    })
    if (!binding) return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    binding.run()
  }
  target.addEventListener('keydown', onKeyDown, true)
  return () => target.removeEventListener('keydown', onKeyDown, true)
}
```

- [ ] **Step 4: 상태바 구현**

`src/renderer/statusbar.ts`:
```ts
import type { SourceEncoding } from '../shared/types'

export type StatusInfo = {
  fileName: string | null
  dirty: boolean
  line: number
  column: number
  characters: number
  encoding: SourceEncoding
  logPaused: boolean
}

export const UNTITLED_NAME = 'untitled'

const ENCODING_LABELS: Record<SourceEncoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 BOM → UTF-8',
  'utf-16le': 'UTF-16 LE → UTF-8',
  'utf-16be': 'UTF-16 BE → UTF-8',
  cp949: 'CP949 → UTF-8',
}

export function describeEncoding(encoding: SourceEncoding): string {
  return ENCODING_LABELS[encoding]
}

export function countCharacters(text: string): number {
  return [...text.replace(/\n/g, '')].length
}

export function formatStatus(info: StatusInfo): { left: string; right: string } {
  const left = `${info.fileName ?? UNTITLED_NAME}${info.dirty ? ' ●' : ''}`
  const parts = [
    `Ln ${info.line}, Col ${info.column}`,
    `${info.characters.toLocaleString('en-US')}자`,
    describeEncoding(info.encoding),
  ]
  if (info.logPaused) parts.push('⏸ paused')
  return { left, right: parts.join('  ·  ') }
}

export function createStatusbar(element: HTMLElement): { update(info: StatusInfo): void } {
  const doc = element.ownerDocument
  const left = doc.createElement('span')
  left.className = 'status-left'
  const right = doc.createElement('span')
  right.className = 'status-right'
  element.replaceChildren(left, right)
  return {
    update(info) {
      const text = formatStatus(info)
      left.textContent = text.left
      right.textContent = text.right
    },
  }
}
```

- [ ] **Step 5: 제목줄 구현**

`src/renderer/titlebar.ts`:
```ts
import type { TitlebarStyle } from './themes'

export type WindowActions = {
  minimize(): void
  toggleMaximize(): void
  close(): void
}

export type Titlebar = { render(style: TitlebarStyle, title: string): void }

export function createTitlebar(
  element: HTMLElement,
  { platform, actions }: { platform: string; actions: WindowActions },
): Titlebar {
  const doc = element.ownerDocument
  const usesNativeWindowButtons = platform === 'darwin'

  function el(tag: string, className: string, text = ''): HTMLElement {
    const node = doc.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }

  function windowButton(action: keyof WindowActions, label: string, className: string): HTMLElement {
    const button = el('button', `tb-button ${className}`, label) as HTMLButtonElement
    button.type = 'button'
    button.dataset.action = action
    button.addEventListener('click', () => actions[action]())
    return button
  }

  function windowsStyle(title: string): HTMLElement[] {
    const tab = el('div', 'tb-tab')
    tab.append(el('span', 'tb-tab-icon', '>_'), el('span', 'tb-tab-title', title), el('span', 'tb-tab-close', '✕'))
    const parts = [tab, el('span', 'tb-new-tab', '+'), el('span', 'tb-dropdown', '⌄'), el('div', 'tb-drag-space')]
    if (!usesNativeWindowButtons) {
      parts.push(
        windowButton('minimize', '─', 'tb-minimize'),
        windowButton('toggleMaximize', '□', 'tb-maximize'),
        windowButton('close', '✕', 'tb-close'),
      )
    }
    return parts
  }

  function macStyle(title: string): HTMLElement[] {
    const parts: HTMLElement[] = []
    if (!usesNativeWindowButtons) {
      const lights = el('div', 'tb-traffic-lights')
      lights.append(
        windowButton('close', '', 'tb-light tb-light-close'),
        windowButton('minimize', '', 'tb-light tb-light-minimize'),
        windowButton('toggleMaximize', '', 'tb-light tb-light-maximize'),
      )
      parts.push(lights)
    }
    parts.push(el('div', 'tb-mac-title', title))
    return parts
  }

  return {
    render(style, title) {
      element.className = `titlebar titlebar-${style}${usesNativeWindowButtons ? ' titlebar-native-buttons' : ''}`
      element.replaceChildren(...(style === 'windows' ? windowsStyle(title) : macStyle(title)))
    },
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/shortcuts.test.ts tests/renderer/statusbar.test.ts tests/renderer/titlebar.test.ts`
Expected: PASS (22 tests)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/shortcuts.ts src/renderer/statusbar.ts src/renderer/titlebar.ts tests/renderer/shortcuts.test.ts tests/renderer/statusbar.test.ts tests/renderer/titlebar.test.ts
git commit -m "feat: 단축키, 상태바, 가짜 터미널 제목줄 추가

단축키는 물리 키 위치(event.code)로 비교해서 한글 자판과 Shift에 영향을
받지 않고, 한글 조합 중에는 반응하지 않는다."
```

---

### Task 17: 설정 창

**Files:**
- Create: `src/renderer/settings-dialog.ts`
- Test: `tests/renderer/settings-dialog.test.ts`

**Interfaces:**
- Consumes: `Settings`, `ThemeId`, `LOG_SPEEDS`, `FILE_FORMATS`, `LogSpeed`, `FileFormat` (Task 1), `FONT_SIZE_RANGE` (Task 1), `parseShortcut`, `displayShortcut` (Task 16)
- Produces: `type SettingsDialog = { open(current: Settings): void; close(): void; isOpen(): boolean }`, `createSettingsDialog(options: { host: HTMLElement; platform: string; themes: { id: ThemeId; name: string }[]; onChange(next: Settings): void }): SettingsDialog` — 각 입력 요소의 `name`은 설정 키와 같다

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/renderer/settings-dialog.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createSettingsDialog } from '../../src/renderer/settings-dialog'
import { defaultSettings } from '../../src/shared/settings'
import type { Settings } from '../../src/shared/types'

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const changes: Settings[] = []
  const dialog = createSettingsDialog({
    host,
    platform: 'win32',
    themes: [
      { id: 'windows-terminal', name: 'Windows Terminal' },
      { id: 'cmd', name: 'CMD' },
      { id: 'wsl-ubuntu', name: 'WSL Ubuntu' },
    ],
    onChange: (next) => changes.push(next),
  })
  const field = <T extends HTMLElement>(name: keyof Settings) => host.querySelector<T>(`[name="${name}"]`)!
  return { host, dialog, changes, field }
}

describe('설정 창', () => {
  it('열면 현재 설정 값을 보여 준다', () => {
    const { dialog, field } = setup()
    dialog.open({ ...defaultSettings('win32'), theme: 'wsl-ubuntu', typingLink: false })
    expect(field<HTMLSelectElement>('theme').value).toBe('wsl-ubuntu')
    expect(field<HTMLInputElement>('typingLink').checked).toBe(false)
    expect(field<HTMLInputElement>('panicKey').value).toBe('Ctrl+`')
  })

  it('테마를 바꾸면 바뀐 설정을 알린다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const select = field<HTMLSelectElement>('theme')
    select.value = 'cmd'
    select.dispatchEvent(new Event('change'))
    expect(changes.at(-1)?.theme).toBe('cmd')
  })

  it('옵션을 끄면 꺼진 설정을 알린다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const checkbox = field<HTMLInputElement>('panicEnabled')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    expect(changes.at(-1)?.panicEnabled).toBe(false)
  })

  it('잇따라 바꾼 설정은 앞서 바꾼 값을 유지한다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const select = field<HTMLSelectElement>('logSpeed')
    select.value = 'fast'
    select.dispatchEvent(new Event('change'))
    const checkbox = field<HTMLInputElement>('syntaxHighlight')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    expect(changes.at(-1)).toMatchObject({ logSpeed: 'fast', syntaxHighlight: false })
  })

  it('잘못된 패닉 키 조합은 받아들이지 않고 표시한다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('panicKey')
    input.value = 'Ctrl+Foo'
    input.dispatchEvent(new Event('input'))
    expect(changes).toHaveLength(0)
    expect(input.classList.contains('invalid')).toBe(true)
  })

  it('올바른 패닉 키 조합은 받아들인다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('panicKey')
    input.value = 'Ctrl+Shift+K'
    input.dispatchEvent(new Event('input'))
    expect(changes.at(-1)?.panicKey).toBe('Ctrl+Shift+K')
  })

  it('허용 범위를 벗어난 글꼴 크기는 받아들이지 않는다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('fontSize')
    input.value = '99'
    input.dispatchEvent(new Event('change'))
    expect(changes).toHaveLength(0)
  })

  it('Esc를 누르면 닫힌다', () => {
    const { host, dialog } = setup()
    dialog.open(defaultSettings('win32'))
    host.querySelector('.settings-panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dialog.isOpen()).toBe(false)
    expect(host.querySelector('.settings-overlay')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/renderer/settings-dialog.test.ts`
Expected: FAIL, import를 찾지 못함

- [ ] **Step 3: 구현**

`src/renderer/settings-dialog.ts`:
```ts
import { FONT_SIZE_RANGE } from '../shared/settings'
import { FILE_FORMATS, LOG_SPEEDS, type FileFormat, type LogSpeed, type Settings, type ThemeId } from '../shared/types'
import { displayShortcut, parseShortcut } from './shortcuts'

export type SettingsDialog = {
  open(current: Settings): void
  close(): void
  isOpen(): boolean
}

export type SettingsDialogOptions = {
  host: HTMLElement
  platform: string
  themes: { id: ThemeId; name: string }[]
  onChange(next: Settings): void
}

const LOG_SPEED_LABELS: Record<LogSpeed, string> = { slow: '느림', normal: '보통', fast: '빠름' }
const FORMAT_LABELS: Record<FileFormat, string> = { md: 'Markdown (.md)', txt: 'Text (.txt)' }

type Option = { value: string; label: string }

export function createSettingsDialog({ host, platform, themes, onChange }: SettingsDialogOptions): SettingsDialog {
  const doc = host.ownerDocument
  let current: Settings | null = null
  let overlay: HTMLElement | null = null

  function update(patch: Partial<Settings>): void {
    if (!current) return
    current = { ...current, ...patch }
    onChange(current)
  }

  function row(label: string, control: HTMLElement): HTMLElement {
    const wrapper = doc.createElement('label')
    wrapper.className = 'settings-row'
    const text = doc.createElement('span')
    text.textContent = label
    wrapper.append(text, control)
    return wrapper
  }

  function selectRow(label: string, name: keyof Settings, options: Option[], value: string, onSelect: (value: string) => void) {
    const select = doc.createElement('select')
    select.name = name
    for (const option of options) {
      const element = doc.createElement('option')
      element.value = option.value
      element.textContent = option.label
      select.append(element)
    }
    select.value = value
    select.addEventListener('change', () => onSelect(select.value))
    return row(label, select)
  }

  function checkboxRow(label: string, name: keyof Settings, checked: boolean, onToggle: (checked: boolean) => void) {
    const input = doc.createElement('input')
    input.type = 'checkbox'
    input.name = name
    input.checked = checked
    input.addEventListener('change', () => onToggle(input.checked))
    return row(label, input)
  }

  function panicKeyRow(value: string) {
    const input = doc.createElement('input')
    input.type = 'text'
    input.name = 'panicKey'
    input.value = displayShortcut(value, platform)
    input.addEventListener('input', () => {
      const isValid = parseShortcut(input.value) !== null
      input.classList.toggle('invalid', !isValid)
      if (isValid) update({ panicKey: input.value })
    })
    return row('패닉 키', input)
  }

  function fontSizeRow(value: number) {
    const input = doc.createElement('input')
    input.type = 'number'
    input.name = 'fontSize'
    input.min = String(FONT_SIZE_RANGE.min)
    input.max = String(FONT_SIZE_RANGE.max)
    input.value = String(value)
    input.addEventListener('change', () => {
      const size = Number(input.value)
      const isValid = Number.isInteger(size) && size >= FONT_SIZE_RANGE.min && size <= FONT_SIZE_RANGE.max
      input.classList.toggle('invalid', !isValid)
      if (isValid) update({ fontSize: size })
    })
    return row('글꼴 크기', input)
  }

  function close(): void {
    overlay?.remove()
    overlay = null
    current = null
  }

  function open(settings: Settings): void {
    close()
    current = settings
    overlay = doc.createElement('div')
    overlay.className = 'settings-overlay'
    const panel = doc.createElement('div')
    panel.className = 'settings-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'settings')

    const title = doc.createElement('div')
    title.className = 'settings-title'
    title.textContent = '# settings'

    const closeButton = doc.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'settings-close'
    closeButton.textContent = 'close (Esc)'
    closeButton.addEventListener('click', close)

    panel.append(
      title,
      selectRow('테마', 'theme', themes.map((theme) => ({ value: theme.id, label: theme.name })), settings.theme, (value) =>
        update({ theme: value as ThemeId }),
      ),
      selectRow(
        '로그 속도',
        'logSpeed',
        LOG_SPEEDS.map((speed) => ({ value: speed, label: LOG_SPEED_LABELS[speed] })),
        settings.logSpeed,
        (value) => update({ logSpeed: value as LogSpeed }),
      ),
      checkboxRow('문법 색칠', 'syntaxHighlight', settings.syntaxHighlight, (checked) => update({ syntaxHighlight: checked })),
      checkboxRow('타이핑 연동', 'typingLink', settings.typingLink, (checked) => update({ typingLink: checked })),
      checkboxRow('패닉 키 사용', 'panicEnabled', settings.panicEnabled, (checked) => update({ panicEnabled: checked })),
      panicKeyRow(settings.panicKey),
      fontSizeRow(settings.fontSize),
      selectRow(
        '기본 저장 형식',
        'defaultFormat',
        FILE_FORMATS.map((format) => ({ value: format, label: FORMAT_LABELS[format] })),
        settings.defaultFormat,
        (value) => update({ defaultFormat: value as FileFormat }),
      ),
      closeButton,
    )

    overlay.append(panel)
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close()
    })
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    })
    host.append(overlay)
    panel.querySelector('select')?.focus()
  }

  return { open, close, isOpen: () => overlay !== null }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/renderer/settings-dialog.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/settings-dialog.ts tests/renderer/settings-dialog.test.ts
git commit -m "feat: 테마, 옵션, 패닉 키, 글꼴 크기를 바꾸는 설정 창 추가

잘못된 패닉 키 조합이나 범위를 벗어난 글꼴 크기는 받아들이지 않고
입력란에 표시한다."
```

---

### Task 18: 화면 조립과 직접 확인

**Files:**
- Create: `src/renderer/app.ts`, `src/renderer/styles.css`
- Modify (전체 교체): `src/renderer/index.html`, `src/renderer/main.ts`

**Interfaces:**
- Consumes: Task 9~17의 모든 renderer 모듈, `ImworkingApi` (Task 7), `FONT_SIZE_RANGE` (Task 1)
- Produces: `startApp(api: ImworkingApi, doc: Document): Promise<void>`

이 Task는 모듈을 연결만 한다. 새로운 판단 로직은 넣지 않는다 (넣어야 한다면 해당 모듈에 테스트와 함께 추가한다). 연결이 맞는지는 앱을 띄워서 확인한다.

- [ ] **Step 1: 화면 뼈대 작성**

`src/renderer/index.html` (전체 교체):
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:"
    />
    <title>Windows PowerShell</title>
  </head>
  <body>
    <header id="titlebar"></header>
    <main id="workspace">
      <section id="log" aria-label="session log"></section>
      <div id="split-handle" role="separator" aria-orientation="horizontal"></div>
      <section id="editor"></section>
    </main>
    <footer id="statusbar"></footer>
    <div id="dialog-host"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: 스타일 작성**

`src/renderer/styles.css`:
```css
:root {
  --font-mono: 'Cascadia Mono', Consolas, Menlo, 'D2Coding', 'Malgun Gothic', 'Apple SD Gothic Neo', monospace;
  --font-ui: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;
  --editor-font-size: 14px;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-mono);
}

body {
  display: grid;
  grid-template-rows: 36px minmax(0, 1fr) 22px;
}

#dialog-host {
  display: contents;
}

/* 가짜 터미널 제목줄 */
.titlebar {
  display: flex;
  align-items: stretch;
  background: var(--color-titlebar-background);
  color: var(--color-titlebar-foreground);
  font-family: var(--font-ui);
  font-size: 12px;
  user-select: none;
  -webkit-app-region: drag;
}

.titlebar-windows.titlebar-native-buttons {
  padding-left: 78px;
}

.tb-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  max-width: 260px;
  margin: 6px 0 0 8px;
  padding: 0 12px;
  background: var(--color-tab-background);
  border-radius: 6px 6px 0 0;
}

.tb-tab-icon {
  font-family: var(--font-mono);
  font-size: 11px;
}

.tb-tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tb-tab-close,
.tb-new-tab,
.tb-dropdown {
  display: flex;
  align-items: center;
  padding: 0 8px;
  opacity: 0.7;
}

.tb-drag-space {
  flex: 1;
}

.tb-button {
  width: 46px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.tb-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tb-close:hover {
  background: #c42b1c;
  color: #fff;
}

.titlebar-mac {
  position: relative;
  align-items: center;
  justify-content: center;
}

.tb-traffic-lights {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tb-light {
  width: 12px;
  height: 12px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  -webkit-app-region: no-drag;
}

.tb-light-close {
  background: #ff5f57;
}

.tb-light-minimize {
  background: #febc2e;
}

.tb-light-maximize {
  background: #28c840;
}

.tb-mac-title {
  font-size: 13px;
  opacity: 0.85;
}

/* 위아래 분할 */
#workspace {
  --split-ratio: 0.55;
  display: grid;
  grid-template-rows: calc((100% - 6px) * var(--split-ratio)) 6px minmax(0, 1fr);
  min-height: 0;
}

#split-handle {
  cursor: row-resize;
  touch-action: none;
  background: var(--color-background);
  border-top: 1px solid var(--color-divider);
  border-bottom: 1px solid var(--color-divider);
}

#split-handle:hover {
  background: var(--color-divider);
}

/* 가짜 세션 */
#log {
  overflow-y: auto;
  padding: 8px 14px;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-line {
  min-height: 1.45em;
}

.role-prompt {
  color: var(--color-prompt);
}

.role-userInput {
  color: var(--color-user-input);
}

.role-toolBullet {
  color: var(--color-tool-bullet);
}

.role-toolName {
  color: var(--color-tool-name);
  font-weight: bold;
}

.role-toolArg {
  color: var(--color-tool-arg);
}

.role-result,
.role-muted {
  color: var(--color-result);
}

.role-diffAdd,
.role-diffRemove {
  display: inline-block;
  width: 100%;
}

.role-diffAdd {
  color: var(--color-diff-add);
  background: var(--color-diff-add-background);
}

.role-diffRemove {
  color: var(--color-diff-remove);
  background: var(--color-diff-remove-background);
}

.role-thinking {
  color: var(--color-thinking);
}

.role-success {
  color: var(--color-success);
}

/* 에디터 */
#editor {
  min-height: 0;
  overflow: hidden;
}

#editor .cm-editor {
  height: 100%;
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--editor-font-size);
}

#editor .cm-editor.cm-focused {
  outline: none;
}

#editor .cm-scroller {
  font-family: var(--font-mono);
  line-height: 1.55;
}

#editor .cm-content {
  padding: 8px 0;
  caret-color: var(--color-cursor);
}

#editor .cm-gutters {
  background: var(--color-background);
  color: var(--color-gutter);
  border-right: 1px solid var(--color-divider);
}

#editor .cm-activeLine {
  background: var(--color-active-line);
}

#editor .cm-activeLineGutter {
  background: transparent;
  color: var(--color-foreground);
}

#editor .cm-cursor {
  border-left: 2px solid var(--color-cursor);
}

#editor .cm-selectionBackground,
#editor .cm-focused .cm-selectionBackground {
  background: var(--color-selection) !important;
}

/* 상태바 */
#statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  background: var(--color-status-background);
  color: var(--color-status-foreground);
  border-top: 1px solid var(--color-divider);
}

/* 설정 창 */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}

.settings-panel {
  min-width: 380px;
  padding: 16px 20px;
  background: var(--color-background);
  color: var(--color-foreground);
  border: 1px solid var(--color-divider);
  font-size: 13px;
}

.settings-title {
  margin-bottom: 12px;
  color: var(--color-md-heading);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0;
}

.settings-row select,
.settings-row input[type='text'],
.settings-row input[type='number'] {
  min-width: 170px;
  padding: 2px 6px;
  background: transparent;
  color: inherit;
  border: 1px solid var(--color-divider);
  font: inherit;
}

.settings-row select option {
  background: var(--color-background);
}

.settings-row input.invalid {
  border-color: var(--color-diff-remove);
}

.settings-close {
  margin-top: 12px;
  padding: 4px 10px;
  background: transparent;
  color: var(--color-muted);
  border: 1px solid var(--color-divider);
  font: inherit;
  cursor: pointer;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background: var(--color-divider);
}

::-webkit-scrollbar-track {
  background: transparent;
}
```

- [ ] **Step 3: 조립 모듈 작성**

`src/renderer/app.ts`:
```ts
import type { ImworkingApi } from '../shared/api'
import { FONT_SIZE_RANGE } from '../shared/settings'
import type { Settings, ThemeId } from '../shared/types'
import { createAutosave } from './autosave'
import { createDocumentCommands, type CommandsApi } from './document-commands'
import { createDocumentState } from './document-state'
import { createEditor, type CursorPosition } from './editor'
import { createLogView } from './fake/log-view'
import { createTypingActivity, delayMultiplier, withIdleThinking } from './fake/pacing'
import { createPlayer } from './fake/player'
import { createSessionStream } from './fake/scenario'
import { createSettingsDialog } from './settings-dialog'
import { APP_SHORTCUTS, bindShortcuts } from './shortcuts'
import { createPanicToggle } from './split-layout'
import { createSplitter } from './splitter'
import { countCharacters, createStatusbar } from './statusbar'
import { THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from './themes'
import { createTitlebar } from './titlebar'

export async function startApp(api: ImworkingApi, doc: Document): Promise<void> {
  const elementById = (id: string): HTMLElement => {
    const element = doc.getElementById(id)
    if (!element) throw new Error(`#${id} is missing in index.html`)
    return element
  }

  let settings = await api.loadSettings()
  let latestText = ''
  let cursor: CursorPosition = { line: 1, column: 1 }

  const titlebar = createTitlebar(elementById('titlebar'), {
    platform: api.platform,
    actions: {
      minimize: () => api.minimizeWindow(),
      toggleMaximize: () => api.toggleMaximizeWindow(),
      close: () => api.requestCloseWindow(),
    },
  })
  const statusbar = createStatusbar(elementById('statusbar'))
  const documentState = createDocumentState(api.defaultEol)

  const typingActivity = createTypingActivity(() => Date.now())
  const sessionStream = createSessionStream(Date.now(), (project) => renderPrompt(getTheme(settings.theme), project))
  const player = createPlayer({
    nextEvent: withIdleThinking(sessionStream, () => settings.typingLink && typingActivity.state() === 'idle'),
    sink: createLogView(elementById('log')),
    delayMultiplier: () =>
      delayMultiplier({ speed: settings.logSpeed, typingLink: settings.typingLink, typingState: typingActivity.state() }),
  })

  function refreshStatus(): void {
    statusbar.update({
      fileName: documentState.fileName(),
      dirty: documentState.isDirty(latestText),
      line: cursor.line,
      column: cursor.column,
      characters: countCharacters(latestText),
      encoding: documentState.info().encoding,
      logPaused: player.isPaused(),
    })
  }

  const editor = createEditor({
    parent: elementById('editor'),
    initialText: '',
    syntaxHighlight: settings.syntaxHighlight,
    onTextChanged: (text) => {
      latestText = text
      refreshStatus()
    },
    onCursorMoved: (position) => {
      cursor = position
      refreshStatus()
    },
    onUserTyped: () => typingActivity.markTyped(),
  })

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
    doc.title = theme.windowTitle
    titlebar.render(theme.titlebarStyle, theme.windowTitle)
  }

  function applySettings(previous: Settings | null): void {
    if (!previous || previous.theme !== settings.theme) applyTheme(settings.theme)
    if (previous && previous.syntaxHighlight !== settings.syntaxHighlight) {
      editor.setSyntaxHighlight(settings.syntaxHighlight)
    }
    doc.documentElement.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
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
      editor.focus()
    }
  }

  function toggleLogPause(): void {
    if (player.isPaused()) player.resume()
    else player.pause()
    refreshStatus()
  }

  const settingsDialog = createSettingsDialog({
    host: elementById('dialog-host'),
    platform: api.platform,
    themes: Object.values(THEMES).map(({ id, name }) => ({ id, name })),
    onChange: (next) => updateSettings(next),
  })

  const autosave = createAutosave({
    takeSnapshot: () => documentState.toBackup(latestText, new Date().toISOString()),
    writeBackup: (backup) => api.writeBackup(backup),
  })

  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path) => api.openPath(path),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
    closeWindowNow: () => api.closeWindowNow(),
    clearBackup: async () => {
      autosave.forgetLastBackup()
      await api.clearBackup()
    },
  }

  const commands = createDocumentCommands({
    api: commandsApi,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
    onFileLocationChanged: (location) => {
      if (!location) updateSettings({ lastFile: null })
      else if (location.origin === 'saved')
        updateSettings({ lastFile: location.path, lastDirectory: location.directory, defaultFormat: location.format })
      else updateSettings({ lastFile: location.path, lastDirectory: location.directory })
      refreshStatus()
    },
    onDocumentReplaced: refreshStatus,
  })

  bindShortcuts(
    doc.defaultView ?? window,
    [
      { combo: () => APP_SHORTCUTS.newDocument, run: () => void commands.newDocument() },
      { combo: () => APP_SHORTCUTS.open, run: () => void commands.open() },
      { combo: () => APP_SHORTCUTS.save, run: () => void commands.save() },
      { combo: () => APP_SHORTCUTS.saveAs, run: () => void commands.saveAs() },
      {
        combo: () => APP_SHORTCUTS.openSettings,
        run: () => (settingsDialog.isOpen() ? settingsDialog.close() : settingsDialog.open(settings)),
      },
      {
        combo: () => APP_SHORTCUTS.toggleSyntaxHighlight,
        run: () => updateSettings({ syntaxHighlight: !settings.syntaxHighlight }),
      },
      { combo: () => APP_SHORTCUTS.toggleLogPause, run: toggleLogPause },
      { combo: () => APP_SHORTCUTS.cycleTheme, run: () => updateSettings({ theme: nextThemeId(settings.theme) }) },
      { combo: () => APP_SHORTCUTS.increaseFontSize, run: () => changeFontSize(1) },
      { combo: () => APP_SHORTCUTS.decreaseFontSize, run: () => changeFontSize(-1) },
      { combo: () => (settings.panicEnabled ? settings.panicKey : null), run: togglePanic },
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

  api.onCloseRequested(async () => {
    // 닫기 확인 창이 떠 있는 동안 자동 백업이 버리기로 한 글을 다시 쓰지 않게 멈춘다.
    autosave.stop()
    const closed = await commands.close()
    if (!closed) autosave.start()
  })

  applySettings(null)
  refreshStatus()
  player.start()

  const backup = await api.readBackup()
  if (backup && (await api.askRestoreBackup(backup.savedAt))) {
    commands.restoreBackup(backup)
  } else {
    if (backup) await api.clearBackup()
    if (settings.lastFile && !(await commands.openPath(settings.lastFile))) updateSettings({ lastFile: null })
  }

  autosave.start()
  editor.focus()
}
```

`src/renderer/main.ts` (전체 교체):
```ts
import './styles.css'
import { startApp } from './app'

const api = window.imworking

startApp(api, document).catch((error: unknown) => {
  // 시작에 실패해도 창은 닫을 수 있어야 한다. 닫기 확인에 답할 화면이 없으면 창이 닫히지 않는다.
  document.body.textContent = `failed to start: ${String(error)}`
  api.onCloseRequested(() => api.closeWindowNow())
})
```

- [ ] **Step 4: 타입 검사와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 타입 오류 없음, 전체 PASS

- [ ] **Step 5: 앱을 띄워서 직접 확인**

Run: `npm run dev`

아래 항목을 하나씩 확인하고, 안 되는 항목이 있으면 원인을 찾아 고친다 (판단 로직 문제면 해당 모듈에 실패하는 테스트부터 추가한다).

1. 위쪽에 `PS C:\dev\...> claude` 프롬프트, 요청 타이핑, `✻ Thinking…` 스피너, `● Read(...)` 같은 도구 호출, diff가 계속 흐른다.
2. 아래 에디터에 `# 제목`, `**굵게**`, `` `코드` `` 를 쓰면 색이 입혀진다. 한글 `안녕하세요 한글 입력 테스트`가 조합 중에 깨지지 않는다.
3. 분할 막대를 드래그하면 크기가 바뀌고, 위아래 모두 일정 크기 아래로는 줄어들지 않는다. 앱을 다시 켜면 같은 비율로 뜬다.
4. `` Ctrl+` ``를 누르면 에디터가 접히고 로그가 전체를 차지한다. 다시 누르면 원래대로 돌아오고 에디터에 커서가 간다.
5. `Ctrl+Shift+T`로 테마 6종이 차례로 바뀌고, 배경, 프롬프트, 제목줄, 작업 표시줄의 창 제목이 같이 바뀐다.
6. `Ctrl+Shift+H`로 문법 색칠이 꺼지고 켜진다. `Ctrl+Shift+P`로 로그가 멈추고 상태바에 `⏸ paused`가 보인다.
7. `Ctrl+,`로 설정 창이 열린다. 로그 속도, 타이핑 연동, 패닉 키 끄기, 글꼴 크기를 바꾸면 바로 반영되고 다시 켜도 유지된다.
8. 글을 쓰면 상태바에 `untitled ●`가 보인다. `Ctrl+S`로 저장 창이 뜨고 `Markdown (*.md)`가 먼저 선택되어 있다. 이름만 쓰고 저장하면 `.md`가 붙는다. ●가 사라진다.
9. `Ctrl+Shift+S`에서 `Text (*.txt)`를 골라 저장하면 `.txt`로 저장되고, 다음 새 문서 저장 때 txt가 먼저 선택되어 있다.
10. 저장한 파일을 메모장으로 열어 한글이 깨지지 않는지 확인한다.
11. 글을 고친 상태에서 제목줄의 ✕를 누르면 저장/저장 안 함/취소를 묻는다. 저장 → 저장 창 취소를 하면 창이 닫히지 않는다.
12. 글을 쓰고 30초 이상 기다린 뒤 `taskkill /IM electron.exe /F`로 강제 종료하고 다시 `npm run dev`를 하면 복구할지 묻는다. 복구하면 글이 돌아오고 상태바에 ●가 있다.
13. 정상 종료 후 다시 켜면 마지막으로 연 파일이 열린다.
14. `Ctrl+휠`로 에디터 글꼴 크기가 바뀐다.

- [ ] **Step 6: Commit**

```bash
git add src/renderer
git commit -m "feat: 화면 모듈 조립과 터미널 스타일 적용

제목줄, 가짜 세션, 분할 막대, 에디터, 상태바, 설정 창, 단축키, 자동
백업을 연결한다. 시작 시 백업 복구를 묻고, 없으면 마지막 파일을 연다."
```

---

### Task 19: 패키징, 바로가기, 문서 갱신

**Files:**
- Create: `electron-builder.yml`, `docs/build.md`
- Modify: `CLAUDE.md`, `DECISIONLOG.md`

- [ ] **Step 1: 패키징 설정 작성**

`electron-builder.yml`:
```yaml
appId: com.hoyeongjeon.imworkinghh
productName: imworkinghh
directories:
  output: dist
files:
  - out/**/*
asar: true
win:
  target:
    - dir
mac:
  target:
    - dmg
  category: public.app-category.productivity
```

- [ ] **Step 2: Windows 빌드**

Run: `npm run dist:win`
Expected: `dist/win-unpacked/imworkinghh.exe` 생성

Run: `dist/win-unpacked/imworkinghh.exe`를 실행
Expected: 개발 모드와 같은 화면이 뜨고, 개발자 도구는 뜨지 않는다. Task 18 Step 5의 1, 4, 8번을 다시 확인한다.

- [ ] **Step 3: 바탕화면 바로가기 만들기**

PowerShell:
```powershell
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('C:\Users\홍길동\Desktop\09_앱_바로가기\imworkinghh.lnk')
$shortcut.TargetPath = 'C:\dev\imworkinghh\dist\win-unpacked\imworkinghh.exe'
$shortcut.WorkingDirectory = 'C:\dev\imworkinghh\dist\win-unpacked'
$shortcut.Save()
Test-Path 'C:\Users\홍길동\Desktop\09_앱_바로가기\imworkinghh.lnk'
```
Expected: `True`, 바로가기를 더블클릭하면 앱이 뜬다.

- [ ] **Step 4: 빌드 문서 작성**

`docs/build.md`:
````markdown
# 빌드와 실행

## 개발

```bash
npm install
npm run dev        # 개발 모드 실행 (개발자 도구가 함께 뜬다)
npm test           # 전체 테스트
npm run typecheck  # 타입 검사
```

## Windows 빌드

```bash
npm run dist:win
```

- 결과: `dist/win-unpacked/imworkinghh.exe` (설치 없이 폴더째 실행)
- 바로가기: `C:\Users\홍길동\Desktop\09_앱_바로가기\imworkinghh.lnk`
- 다시 빌드하기 전에 실행 중인 앱을 닫는다. 실행 중이면 exe를 덮어쓰지 못한다.

## macOS 빌드

맥용 앱은 맥에서만 빌드할 수 있다.

1. Node.js LTS 설치: `brew install node` 또는 https://nodejs.org
2. 저장소를 받고 폴더로 이동
3. 빌드:
   ```bash
   npm ci
   npm run dist:mac
   ```
4. 결과: `dist/imworkinghh-<버전>.dmg`. 열어서 Applications로 끌어 놓는다.
5. 서명하지 않은 앱이라 처음 한 번은 Finder에서 앱을 우클릭 → 열기 → 열기로 허용한다.

## 데이터 위치

| 항목 | Windows | macOS |
|---|---|---|
| 설정 | `%APPDATA%\imworkinghh\settings.json` | `~/Library/Application Support/imworkinghh/settings.json` |
| 자동 백업 | `%APPDATA%\imworkinghh\backup\current.json` | `~/Library/Application Support/imworkinghh/backup/current.json` |

설정 파일이 깨지면 `settings.bad.json`으로 옮겨지고 기본값으로 시작한다.
````

- [ ] **Step 5: CLAUDE.md와 결정 기록 갱신**

`CLAUDE.md`의 `## 스택` 섹션 바로 아래에 추가한다:
```markdown
## 명령어

`npm run dev` (실행), `npm test` (테스트), `npm run typecheck` (타입 검사), `npm run dist:win` / `npm run dist:mac` (빌드)
```

`CLAUDE.md`의 문서 표에 한 줄을 추가한다:
```markdown
| [`docs/build.md`](docs/build.md) | 개발 실행, Windows/macOS 빌드, 바로가기, 설정/백업 파일 위치 |
```

`DECISIONLOG.md` 끝에 추가한다:
```markdown

## D-020 Windows는 설치 프로그램 없이 폴더형으로 배포
- 2026-10-08 / 확정
- 결정: electron-builder의 `dir` 대상으로 `dist/win-unpacked/`에 실행 파일을 만들고 바탕화면 바로가기로 실행한다.
- 대안: NSIS 설치 프로그램, 단일 portable exe
- 이유: 설치 과정이 없고 실행이 빠르다. portable exe는 실행할 때마다 압축을 풀어서 느리다. pdf-merger와 같은 방식이다.
```

- [ ] **Step 6: 전체 확인과 Commit**

Run: `npm run typecheck && npm test`
Expected: 오류 없음, 전체 PASS

```bash
git add electron-builder.yml docs/build.md CLAUDE.md DECISIONLOG.md
git commit -m "build: Windows 폴더형 패키징과 빌드 문서 추가 (D-020)

electron-builder로 Windows는 dist/win-unpacked, macOS는 dmg를 만든다.
빌드 방법, 맥 첫 실행 허용 방법, 설정과 백업 파일 위치를 문서로 남긴다."
```

---

## 스펙 대응표

| 스펙 | Task |
|---|---|
| 3. 화면 구성 (제목줄 위장, 메뉴바 없음, 분할 비율 저장, 최소 80px) | 8, 13, 16, 18 |
| 4. 단축키 (Ctrl/Cmd 자동, 패닉 키 OS별 기본값, Ctrl+휠) | 1, 16, 18 |
| 5. 가짜 Claude Code 세션 (생성기, 출력기, 3000줄, 자동 스크롤, 옵션) | 10, 11, 12 |
| 6. 에디터 (줄번호, 줄바꿈, 문법 색칠 토글, 코드블록 언어 색칠) | 14 |
| 7. 테마 (6종, 프롬프트, 창 제목, 글꼴) | 9, 18 |
| 8.1 형식 (.md/.txt 필터, 확장자 자동, 같은 경로 저장) | 3, 7 |
| 8.2 안전한 쓰기 | 4 |
| 8.3 인코딩과 줄바꿈 | 2, 5, 16 (상태바 표시) |
| 8.4 변경 여부와 저장 확인 | 15 |
| 8.5 자동 백업, 복구, 마지막 파일 다시 열기 | 6, 15, 18 |
| 8.6 오류 처리, 큰 파일 확인 | 3, 5, 7, 8 |
| 9. 설정 (교정, 깨진 파일, 창 위치) | 1, 6, 8, 17 |
| 2. 맥 빌드, 바로가기 | 19 |
