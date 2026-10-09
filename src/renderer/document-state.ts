import type { OpenedFile } from '../shared/api'
import type { Eol, PaneBackup, FileFormat, SourceEncoding } from '../shared/types'

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
  loadUnsaved(backup: PaneBackup): void
  markSaved(saved: { path: string; format: FileFormat }, savedText: string): void
  snapshot(currentText: string): PaneBackup
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
    snapshot(currentText) {
      return { path: info.path, eol: info.eol, unsavedContent: isDirty(currentText) ? currentText : null }
    },
  }
}
