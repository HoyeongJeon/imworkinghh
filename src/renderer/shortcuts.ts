export const APP_SHORTCUTS = {
  newDocument: 'Mod+N',
  open: 'Mod+O',
  save: 'Mod+S',
  saveAs: 'Mod+Shift+S',
  openSettings: 'Mod+,',
  toggleSyntaxHighlight: 'Mod+Shift+H',
  toggleLogPause: 'Mod+Shift+P',
  cycleTheme: 'Mod+Shift+T',
  toggleStealthMode: 'Mod+Shift+M',
  increaseFontSize: 'Mod+=',
  decreaseFontSize: 'Mod+-',
  addPane: 'Mod+\\',
  closePane: 'Mod+W',
  // macOS에서 Cmd+Tab은 앱 전환 키라서 두 OS 모두 Ctrl을 쓴다.
  nextPane: 'Ctrl+Tab',
} as const

export type KeyPress = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'keyCode'>

export type ParsedShortcut = { code: string; mod: boolean; ctrl: boolean; cmd: boolean; shift: boolean; alt: boolean }

export type ShortcutBinding = { combo(): string | null; run(): void }

const IME_PROCESSING_KEY_CODE = 229

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

const CODE_BY_NAMED_KEY: Record<string, string> = {
  Tab: 'Tab',
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
  return CODE_BY_SYMBOL[keyName] ?? CODE_BY_NAMED_KEY[keyName] ?? null
}

export function isUsableAppShortcut(combo: string): boolean {
  const shortcut = parseShortcut(combo)
  return shortcut !== null && (shortcut.mod || shortcut.ctrl || shortcut.cmd || shortcut.alt)
}

export function matchesShortcut(press: KeyPress, combo: string, platform: string): boolean {
  // 일부 IME는 조합을 시작하는 첫 keydown에서 isComposing 대신 keyCode 229만 보낸다.
  if (press.isComposing || press.keyCode === IME_PROCESSING_KEY_CODE) return false
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
