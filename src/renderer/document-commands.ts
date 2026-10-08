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
  function unlessBusy<Args extends unknown[]>(command: (...args: Args) => Promise<boolean>) {
    return (...args: Args): Promise<boolean> => (running ? Promise.resolve(false) : track(command(...args)))
  }

  // 다른 프로그램에서 연 파일은 다시 요청할 방법이 없으므로 버리지 않고 진행 중인 명령이 끝나기를 기다린다.
  function afterRunning<Args extends unknown[]>(command: (...args: Args) => Promise<boolean>) {
    return async (...args: Args): Promise<boolean> => {
      while (running) await running.catch(() => false)
      return track(command(...args))
    }
  }

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
    newDocument: unlessBusy(async () => {
      if (!(await resolveUnsavedChanges())) return false
      documentState.startNew()
      editor.setText('')
      await api.clearBackup()
      deps.onDocumentReplaced()
      deps.onFileLocationChanged(null)
      return true
    }),

    open: unlessBusy(async () => {
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openFileDialog(deps.savePreferences().defaultDirectory)
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      await api.clearBackup()
      return true
    }),

    save: unlessBusy(() => saveDocument(false)),

    saveAs: unlessBusy(() => saveDocument(true)),

    close: unlessBusy(async () => {
      if (!(await resolveUnsavedChanges())) return false
      await api.clearBackup()
      api.closeWindowNow()
      return true
    }),

    openPath: unlessBusy(async (path: string) => {
      const result = await api.openPath(path)
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      return true
    }),

    openRequestedFile: afterRunning(async (path: string) => {
      if (!(await resolveUnsavedChanges())) return false
      const result = await api.openPath(path, { reportErrors: true })
      if (result.status !== 'opened') return false
      showOpenedFile(result.file)
      await api.clearBackup()
      return true
    }),

    restoreBackup(backup) {
      documentState.loadUnsaved(backup)
      editor.setText(backup.content)
      deps.onDocumentReplaced()
    },
  }
}
