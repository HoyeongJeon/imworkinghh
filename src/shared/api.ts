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
  openPath(path: string, options?: { reportErrors?: boolean }): Promise<OpenResult>
  takeRequestedFile(): Promise<string | null>
  onFileOpenRequested(listener: (path: string) => void): void
  pathForFile(file: File): string
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
