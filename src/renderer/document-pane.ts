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
