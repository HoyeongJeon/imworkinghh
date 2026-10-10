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
  // 잠금을 기다리지 않는다. 기다리는 동안 이 칸이 닫힐 수 있으므로 workspace-commands가 기다린 뒤 열 칸을 고른다.
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

    async openRequestedFile(path) {
      if (deps.focusIfOpenElsewhere(path)) return false
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openPath(path, { reportErrors: true })
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      deps.onBackupStale()
      return true
    },

    restore: lock.unlessBusy(async (backup: PaneBackup) => {
      if (backup.unsavedContent === null) return backup.path === null ? false : openSilently(backup.path)
      documentState.loadUnsaved(backup)
      editor.setText(backup.unsavedContent)
      deps.onDocumentReplaced()
      return true
    }),
  }
}
