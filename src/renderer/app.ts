import type { ImworkingApi } from '../shared/api'
import { FONT_SIZE_RANGE } from '../shared/settings'
import type { Settings, ThemeId } from '../shared/types'
import { createAutosave } from './autosave'
import { createDocumentCommands, type CommandsApi } from './document-commands'
import { createDocumentState } from './document-state'
import { createEditor, type CursorPosition } from './editor'
import { createLogView } from './fake/log-view'
import { createTypingActivity, delayMultiplier, withIdleThinking } from './fake/pacing'
import { createPlayer } from './fake/player'
import { createSessionStream } from './fake/scenario'
import { createSettingsDialog } from './settings-dialog'
import { APP_SHORTCUTS, bindShortcuts } from './shortcuts'
import { createPanicToggle } from './split-layout'
import { createSplitter } from './splitter'
import { countCharacters, createStatusbar } from './statusbar'
import { THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from './themes'
import { createTitlebar } from './titlebar'

export async function startApp(api: ImworkingApi, doc: Document): Promise<void> {
  const elementById = (id: string): HTMLElement => {
    const element = doc.getElementById(id)
    if (!element) throw new Error(`#${id} is missing in index.html`)
    return element
  }

  let settings = await api.loadSettings()
  let latestText = ''
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
      dirty: documentState.isDirty(latestText),
      line: cursor.line,
      column: cursor.column,
      characters: countCharacters(latestText),
      encoding: documentState.info().encoding,
      logPaused: player.isPaused(),
    })
  }

  const editor = createEditor({
    parent: elementById('editor'),
    initialText: '',
    syntaxHighlight: settings.syntaxHighlight,
    onTextChanged: (text) => {
      latestText = text
      refreshStatus()
    },
    onCursorMoved: (position) => {
      cursor = position
      refreshStatus()
    },
    onUserTyped: () => typingActivity.markTyped(),
  })

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
    doc.title = theme.windowTitle
    titlebar.render(theme.titlebarStyle, theme.windowTitle)
  }

  function applySettings(previous: Settings | null): void {
    if (!previous || previous.theme !== settings.theme) applyTheme(settings.theme)
    if (previous && previous.syntaxHighlight !== settings.syntaxHighlight) {
      editor.setSyntaxHighlight(settings.syntaxHighlight)
    }
    doc.documentElement.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
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
    onChange: (next) => updateSettings(next),
  })

  const autosave = createAutosave({
    takeSnapshot: () => documentState.toBackup(latestText, new Date().toISOString()),
    writeBackup: (backup) => api.writeBackup(backup),
  })

  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path) => api.openPath(path),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
    closeWindowNow: () => api.closeWindowNow(),
    clearBackup: async () => {
      autosave.forgetLastBackup()
      await api.clearBackup()
    },
  }

  const commands = createDocumentCommands({
    api: commandsApi,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
    onFileLocationChanged: (location) => {
      if (!location) updateSettings({ lastFile: null })
      else if (location.origin === 'saved')
        updateSettings({ lastFile: location.path, lastDirectory: location.directory, defaultFormat: location.format })
      else updateSettings({ lastFile: location.path, lastDirectory: location.directory })
      refreshStatus()
    },
    onDocumentReplaced: refreshStatus,
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
      { combo: () => APP_SHORTCUTS.toggleLogPause, run: toggleLogPause },
      { combo: () => APP_SHORTCUTS.cycleTheme, run: () => updateSettings({ theme: nextThemeId(settings.theme) }) },
      { combo: () => APP_SHORTCUTS.increaseFontSize, run: () => changeFontSize(1) },
      { combo: () => APP_SHORTCUTS.decreaseFontSize, run: () => changeFontSize(-1) },
      { combo: () => (settings.panicEnabled ? settings.panicKey : null), run: togglePanic },
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

  api.onCloseRequested(async () => {
    // 닫기 확인 창이 떠 있는 동안 자동 백업이 버리기로 한 글을 다시 쓰지 않게 멈춘다.
    autosave.stop()
    const closed = await commands.close()
    if (!closed) autosave.start()
  })

  applySettings(null)
  refreshStatus()
  player.start()

  const backup = await api.readBackup()
  if (backup && (await api.askRestoreBackup(backup.savedAt))) {
    commands.restoreBackup(backup)
  } else {
    if (backup) await api.clearBackup()
    if (settings.lastFile && !(await commands.openPath(settings.lastFile))) updateSettings({ lastFile: null })
  }

  autosave.start()
  editor.focus()
}
