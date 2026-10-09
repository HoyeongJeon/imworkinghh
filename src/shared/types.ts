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
  lastFile: string | null
  defaultFormat: FileFormat
}

export type Backup = {
  path: string | null
  content: string
  eol: Eol
  savedAt: string
}
