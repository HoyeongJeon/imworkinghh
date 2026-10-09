import type { ImworkingApi } from '../shared/api'
import { FONT_SIZE_RANGE } from '../shared/settings'
import type { Settings, ThemeId } from '../shared/types'
import { backupSetOf, createAutosave, unsavedPaneCount } from './autosave'
import { createCloseHandler } from './close-handler'
import { createDebouncedTask } from './debounce'
import { createDocumentCommands, type CommandsApi } from './document-commands'
import { createDocumentState } from './document-state'
import { createEditor, type CursorPosition } from './editor'
import { createLogView } from './fake/log-view'
import { installFileDrop } from './file-drop'
import { createTypingActivity, delayMultiplier, withIdleThinking } from './fake/pacing'
import { createPlayer } from './fake/player'
import { createSessionStream } from './fake/scenario'
import { createSettingsDialog } from './settings-dialog'
import { APP_SHORTCUTS, bindShortcuts } from './shortcuts'
import { createPanicToggle } from './split-layout'
import { createSplitter } from './splitter'
import { UNTITLED_NAME, countCharacters, createStatusbar } from './statusbar'
import { createSessionHider, windowTitleFor } from './stealth'
import { THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from './themes'
import { createTitlebar } from './titlebar'

const DOCUMENT_STATUS_DELAY_MS = 150

export async function startApp(api: ImworkingApi, doc: Document): Promise<void> {
  const elementById = (id: string): HTMLElement => {
    const element = doc.getElementById(id)
    if (!element) throw new Error(`#${id} is missing in index.html`)
    return element
  }

  let settings = await api.loadSettings()
  let documentStats = { dirty: false, characters: 0 }
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
      dirty: documentStats.dirty,
      line: cursor.line,
      column: cursor.column,
      characters: documentStats.characters,
      encoding: documentState.info().encoding,
      logPaused: settings.stealthMode && player.isPaused(),
    })
    refreshWindowTitle()
  }

  let renderedTitlebar = ''
  function refreshWindowTitle(): void {
    const theme = getTheme(settings.theme)
    const title = windowTitleFor({
      stealthMode: settings.stealthMode,
      disguisedTitle: theme.windowTitle,
      documentName: documentState.fileName() ?? UNTITLED_NAME,
      dirty: documentStats.dirty,
    })
    doc.title = title
    const titlebarKey = `${theme.titlebarStyle}|${title}`
    if (titlebarKey === renderedTitlebar) return
    renderedTitlebar = titlebarKey
    titlebar.render(theme.titlebarStyle, title)
  }

  // 글 전체를 읽어 세는 일은 큰 글에서 무거우므로, 입력할 때마다 하지 않고 입력이 잠깐 멈췄을 때 한다.
  const documentStatus = createDebouncedTask(() => {
    const text = editor.getText()
    documentStats = { dirty: documentState.isDirty(text), characters: countCharacters(text) }
    refreshStatus()
  }, DOCUMENT_STATUS_DELAY_MS)

  const editor = createEditor({
    parent: elementById('editor'),
    initialText: '',
    syntaxHighlight: settings.syntaxHighlight,
    onTextChanged: () => documentStatus.schedule(),
    onCursorMoved: (position) => {
      cursor = position
      refreshStatus()
    },
    onUserTyped: () => typingActivity.markTyped(),
  })

  const sessionHider = createSessionHider(player)
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
    refreshWindowTitle()
  }

  function applyStealthMode(): void {
    elementById('workspace').classList.toggle('session-hidden', !settings.stealthMode)
    // 터미널에는 줄 번호가 없으므로 은신 모드에서는 숨긴다.
    editor.setLineNumbersVisible(!settings.stealthMode)
    if (settings.stealthMode) {
      sessionHider.show()
    } else {
      if (panic.isPanicked()) splitter.setRatio(panic.toggle(splitter.getRatio()))
      sessionHider.hide()
    }
    refreshStatus()
  }

  function applySettings(previous: Settings | null): void {
    if (!previous || previous.theme !== settings.theme) applyTheme(settings.theme)
    if (!previous || previous.stealthMode !== settings.stealthMode) applyStealthMode()
    if (previous && previous.syntaxHighlight !== settings.syntaxHighlight) {
      editor.setSyntaxHighlight(settings.syntaxHighlight)
    }
    editor.setFontSize(settings.fontSize)
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
    onChange: (patch) => updateSettings(patch),
  })

  const autosave = createAutosave({
    takeSnapshot: () => backupSetOf([documentState.snapshot(editor.getText())], new Date().toISOString()),
    writeBackup: (backup) => api.writeBackup(backup),
    clearBackup: () => api.clearBackup(),
  })

  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path, options) => api.openPath(path, options),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
    closeWindowNow: () => api.closeWindowNow(),
    clearBackup: () => api.clearBackup(),
  }

  const commands = createDocumentCommands({
    api: commandsApi,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
    onFileLocationChanged: (location) => {
      if (!location) updateSettings({ openFiles: [] })
      else if (location.origin === 'saved')
        updateSettings({ openFiles: [location.path], lastDirectory: location.directory, defaultFormat: location.format })
      else updateSettings({ openFiles: [location.path], lastDirectory: location.directory })
      documentStatus.runNow()
    },
    onDocumentReplaced: () => documentStatus.runNow(),
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
      { combo: () => (settings.stealthMode ? APP_SHORTCUTS.toggleLogPause : null), run: toggleLogPause },
      { combo: () => APP_SHORTCUTS.cycleTheme, run: () => updateSettings({ theme: nextThemeId(settings.theme) }) },
      {
        combo: () => APP_SHORTCUTS.toggleStealthMode,
        run: () => updateSettings({ stealthMode: !settings.stealthMode }),
      },
      { combo: () => APP_SHORTCUTS.increaseFontSize, run: () => changeFontSize(1) },
      { combo: () => APP_SHORTCUTS.decreaseFontSize, run: () => changeFontSize(-1) },
      // 은신 모드를 끄면 숨길 가짜 화면이 없으므로 패닉 키도 쓰지 않는다.
      { combo: () => (settings.stealthMode && settings.panicEnabled ? settings.panicKey : null), run: togglePanic },
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

  let startupFinished = false
  api.onCloseRequested(
    createCloseHandler({
      isStartupFinished: () => startupFinished,
      closeDocument: () => commands.close(),
      closeWindowNow: () => api.closeWindowNow(),
      pauseAutosave: () => autosave.stop(),
      resumeAutosave: () => autosave.start(),
    }),
  )
  installFileDrop(doc, {
    pathForFile: (file) => api.pathForFile(file),
    onFileDropped: (path) => void commands.openRequestedFile(path),
  })

  applySettings(null)
  refreshStatus()
  player.start()

  const backup = await api.readBackup()
  const unsavedCount = backup ? unsavedPaneCount(backup) : 0
  const restored = backup !== null && unsavedCount > 0 && (await api.askRestoreBackup(backup.savedAt, unsavedCount))
  const restoredPane = backup?.panes.find((pane) => pane.unsavedContent !== null)
  if (restored && restoredPane) commands.restoreBackup(restoredPane)
  else if (backup) await api.clearBackup()

  // main은 대기 중인 파일을 넘겨준 뒤부터 요청을 바로 보내므로, 그보다 먼저 받을 준비를 해야 요청이 사라지지 않는다.
  api.onFileOpenRequested((path) => void commands.openRequestedFile(path))
  const requestedFile = await api.takeRequestedFile()
  const [lastOpenFile] = settings.openFiles
  if (requestedFile) await commands.openRequestedFile(requestedFile)
  else if (!restored && lastOpenFile && !(await commands.openPath(lastOpenFile))) {
    updateSettings({ openFiles: [] })
  }
  startupFinished = true

  autosave.start()
  editor.focus()
}
