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
  openRequestedFile(path: string): Promise<boolean>
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

    async openRequestedFile(path) {
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openPath(path, { reportErrors: true })
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      await api.clearBackup()
      return true
    },

    restoreBackup(backup) {
      documentState.loadUnsaved(backup)
      editor.setText(backup.content)
      deps.onDocumentReplaced()
    },
  }
}
