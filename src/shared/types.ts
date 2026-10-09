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
  stealthMode: boolean
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
  openFiles: string[]
  paneWidths: number[]
  defaultFormat: FileFormat
}

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
