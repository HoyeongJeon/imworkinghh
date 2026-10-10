import type { ImworkingApi } from '../shared/api'
import { MAX_PANES } from '../shared/panes'
import { FONT_SIZE_RANGE } from '../shared/settings'
import type { Settings, ThemeId } from '../shared/types'
import { backupSetOf, createAutosave, guardUnreadBackup } from './autosave'
import { createCloseHandler } from './close-handler'
import { createCommandLock } from './command-lock'
import { createDebouncedTask } from './debounce'
import { createDocumentCommands, type CommandsApi } from './document-commands'
import { createDocumentPane, type DocumentPane } from './document-pane'
import { createDocumentState } from './document-state'
import { createEditor } from './editor'
import { createLogView } from './fake/log-view'
import { installFileDrop } from './file-drop'
import { createTypingActivity, delayMultiplier, withIdleThinking } from './fake/pacing'
import { createPlayer } from './fake/player'
import { createSessionStream } from './fake/scenario'
import { PANE_DIVIDER_PX, createPaneLayout } from './pane-dividers'
import { createPaneSet, type PaneChange } from './pane-set'
import { MIN_PANE_WIDTH_PX, canAddPane, equalWidths, widthsAfterAdd, widthsAfterRemove } from './pane-widths'
import { createSettingsDialog } from './settings-dialog'
import { APP_SHORTCUTS, bindShortcuts } from './shortcuts'
import { createPanicToggle } from './split-layout'
import { createSplitter } from './splitter'
import { UNTITLED_NAME, createStatusbar } from './statusbar'
import { createSessionHider, windowTitleFor } from './stealth'
import { THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from './themes'
import { createTitlebar } from './titlebar'
import { createWorkspaceCommands, panesToRestore } from './workspace-commands'

export async function startApp(api: ImworkingApi, doc: Document): Promise<void> {
  const elementById = (id: string): HTMLElement => {
    const element = doc.getElementById(id)
    if (!element) throw new Error(`#${id} is missing in index.html`)
    return element
  }

  let settings = await api.loadSettings()
  const startupOpenFiles = settings.openFiles
  const startupPaneWidths = settings.paneWidths
  let startupFinished = false

  const titlebar = createTitlebar(elementById('titlebar'), {
    platform: api.platform,
    actions: {
      minimize: () => api.minimizeWindow(),
      toggleMaximize: () => api.toggleMaximizeWindow(),
      close: () => api.requestCloseWindow(),
    },
  })
  const statusbar = createStatusbar(elementById('statusbar'))

  const typingActivity = createTypingActivity(() => Date.now())
  const sessionStream = createSessionStream(Date.now(), (project) => renderPrompt(getTheme(settings.theme), project))
  const player = createPlayer({
    nextEvent: withIdleThinking(sessionStream, () => settings.typingLink && typingActivity.state() === 'idle'),
    sink: createLogView(elementById('log')),
    delayMultiplier: () =>
      delayMultiplier({ speed: settings.logSpeed, typingLink: settings.typingLink, typingState: typingActivity.state() }),
  })

  function refreshStatus(): void {
    statusbar.update({ ...panes.focused().status(), logPaused: settings.stealthMode && player.isPaused() })
    refreshWindowTitle()
  }

  let renderedTitlebar = ''
  function refreshWindowTitle(): void {
    const theme = getTheme(settings.theme)
    const { fileName, dirty } = panes.focused().status()
    const title = windowTitleFor({
      stealthMode: settings.stealthMode,
      disguisedTitle: theme.windowTitle,
      documentName: fileName ?? UNTITLED_NAME,
      dirty,
    })
    doc.title = title
    const titlebarKey = `${theme.titlebarStyle}|${title}`
    if (titlebarKey === renderedTitlebar) return
    renderedTitlebar = titlebarKey
    titlebar.render(theme.titlebarStyle, title)
  }

  const commandLock = createCommandLock()
  const commandsApi: CommandsApi = {
    openFileDialog: (directory) => api.openFileDialog(directory),
    openPath: (path, options) => api.openPath(path, options),
    saveFile: (request) => api.saveFile(request),
    confirmDiscard: () => api.confirmDiscard(),
  }
  const paneParts = { createEditor, createDocumentState, createDocumentCommands, createDebouncedTask }

  function openFilePaths(): string[] {
    return panes.all().flatMap((pane) => {
      const path = pane.filePath()
      return path ? [path] : []
    })
  }

  function createPane(): DocumentPane {
    const pane: DocumentPane = createDocumentPane({
      doc,
      parts: paneParts,
      defaultEol: api.defaultEol,
      display: {
        syntaxHighlight: settings.syntaxHighlight,
        fontSize: settings.fontSize,
        // 터미널에는 줄 번호가 없으므로 은신 모드에서는 숨긴다.
        lineNumbersVisible: !settings.stealthMode,
      },
      api: commandsApi,
      lock: commandLock,
      savePreferences: () => ({ defaultDirectory: settings.lastDirectory, defaultFormat: settings.defaultFormat }),
      focusIfOpenElsewhere: (path) => workspace.focusPaneWithFile(path, pane),
      onFileLocationChanged: (location) => {
        const patch: Partial<Settings> = { openFiles: openFilePaths() }
        if (location) patch.lastDirectory = location.directory
        if (location?.origin === 'saved') patch.defaultFormat = location.format
        updateSettings(patch)
      },
      onBackupStale: () => void autosave.flushNow(),
      onStatusChanged: () => {
        if (panes.focused() === pane) refreshStatus()
      },
      onUserTyped: () => typingActivity.markTyped(),
      onFocused: () => panes.focus(pane),
    })
    return pane
  }

  let paneWidths = [1]
  const paneLayout = createPaneLayout({
    host: elementById('editor'),
    minPanePx: MIN_PANE_WIDTH_PX,
    onWidthsCommitted: (widths) => {
      paneWidths = widths
      updateSettings({ paneWidths })
    },
  })

  function paneAreaWidth(paneCount: number): number {
    return paneLayout.hostWidth() - PANE_DIVIDER_PX * (paneCount - 1)
  }

  function renderPanes(): void {
    paneLayout.render(
      panes.all().map((pane) => pane.element),
      paneWidths,
    )
  }

  function onPanesChanged(change: PaneChange): void {
    if (change.kind === 'added') {
      const area = paneAreaWidth(panes.all().length)
      paneWidths = widthsAfterAdd(paneWidths, change.index - 1, area > 0 ? MIN_PANE_WIDTH_PX / area : 1)
    }
    if (change.kind === 'removed') paneWidths = widthsAfterRemove(paneWidths, change.index)
    if (change.kind !== 'focused') {
      renderPanes()
      if (startupFinished) updateSettings({ openFiles: openFilePaths(), paneWidths })
    }
    refreshStatus()
  }

  const panes = createPaneSet<DocumentPane>({
    maxPanes: MAX_PANES,
    createPane,
    destroyPane: (pane) => pane.destroy(),
    onChanged: onPanesChanged,
  })
  renderPanes()

  const backupFile = guardUnreadBackup({
    writeBackup: (backup) => api.writeBackup(backup),
    clearBackup: () => api.clearBackup(),
  })

  const workspace = createWorkspaceCommands({
    panes,
    maxPanes: MAX_PANES,
    lock: commandLock,
    onBackupStale: () => void autosave.flushNow(),
    clearBackup: () => backupFile.clearBackup(),
    closeWindowNow: () => api.closeWindowNow(),
  })

  function forEachPane(apply: (pane: DocumentPane) => void): void {
    for (const pane of panes.all()) apply(pane)
  }

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
    forEachPane((pane) => pane.setLineNumbersVisible(!settings.stealthMode))
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
      forEachPane((pane) => pane.setSyntaxHighlight(settings.syntaxHighlight))
    }
    if (previous && previous.fontSize !== settings.fontSize) {
      forEachPane((pane) => pane.setFontSize(settings.fontSize))
    }
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
      panes.focused().focus()
    }
  }

  function toggleLogPause(): void {
    if (player.isPaused()) player.resume()
    else player.pause()
    refreshStatus()
  }

  function addPane(): void {
    const count = panes.all().length
    if (!canAddPane(count, paneAreaWidth(count + 1), MIN_PANE_WIDTH_PX)) return
    workspace.addPane()
  }

  function focusNextPane(): void {
    panes.focusNext()
    panes.focused().focus()
  }

  // 시작할 때 백업 복구는 명령 잠금을 쓰므로, 그 전에 들어온 문서 명령이 잠금을 먼저 잡으면 복구한 글이 에디터에 들어가지 못한다.
  const afterStartup = (run: () => void) => () => {
    if (startupFinished) run()
  }

  const settingsDialog = createSettingsDialog({
    host: elementById('dialog-host'),
    platform: api.platform,
    themes: Object.values(THEMES).map(({ id, name }) => ({ id, name })),
    onChange: (patch) => updateSettings(patch),
  })

  const autosave = createAutosave({
    takeSnapshot: () => backupSetOf(panes.all().map((pane) => pane.snapshot()), new Date().toISOString()),
    writeBackup: (backup) => backupFile.writeBackup(backup),
    clearBackup: () => backupFile.clearBackup(),
  })

  const focusedCommands = () => panes.focused().commands

  bindShortcuts(
    doc.defaultView ?? window,
    [
      // 같은 조합이면 앞의 것만 실행되므로, 사용자가 고른 패닉 키가 앱 단축키(칸 닫기 등)에 가려지지 않게 맨 앞에 둔다.
      // 은신 모드를 끄면 숨길 가짜 화면이 없으므로 패닉 키도 쓰지 않는다.
      { combo: () => (settings.stealthMode && settings.panicEnabled ? settings.panicKey : null), run: togglePanic },
      { combo: () => APP_SHORTCUTS.newDocument, run: afterStartup(() => void focusedCommands().newDocument()) },
      { combo: () => APP_SHORTCUTS.open, run: afterStartup(() => void focusedCommands().open()) },
      { combo: () => APP_SHORTCUTS.save, run: afterStartup(() => void focusedCommands().save()) },
      { combo: () => APP_SHORTCUTS.saveAs, run: afterStartup(() => void focusedCommands().saveAs()) },
      { combo: () => APP_SHORTCUTS.addPane, run: afterStartup(addPane) },
      { combo: () => APP_SHORTCUTS.closePane, run: afterStartup(() => void workspace.closeFocusedPane()) },
      { combo: () => APP_SHORTCUTS.nextPane, run: afterStartup(focusNextPane) },
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

  api.onCloseRequested(
    createCloseHandler({
      isStartupFinished: () => startupFinished,
      closeWindow: () => workspace.closeWindow(),
      closeWindowNow: () => api.closeWindowNow(),
      pauseAutosave: () => autosave.stop(),
      resumeAutosave: () => autosave.start(),
    }),
  )
  installFileDrop(doc, {
    pathForFile: (file) => api.pathForFile(file),
    onFileDropped: (path, dropTarget) => {
      if (!startupFinished) return
      const target = panes.all().find((pane) => dropTarget instanceof Node && pane.element.contains(dropTarget))
      void workspace.openRequestedFile(path, target)
    },
  })

  applySettings(null)
  refreshStatus()
  player.start()

  // 백업 파일이 계속 잠겨 있어 읽지 못해도 앱은 시작하고, 복구는 건너뛰되 그 백업은 지우지 않는다.
  const backup = await api.readBackup().catch(() => {
    backupFile.keepUntilOverwritten()
    return null
  })
  const unsavedCount = backup
    ? panesToRestore(backup.panes, MAX_PANES).filter((pane) => pane.unsavedContent !== null).length
    : 0
  const restored = backup !== null && unsavedCount > 0 && (await api.askRestoreBackup(backup.savedAt, unsavedCount))
  if (backup && restored) await workspace.restore(backup)
  else if (backup) await api.clearBackup()

  // main은 대기 중인 파일을 넘겨준 뒤부터 요청을 바로 보내므로, 그보다 먼저 받을 준비를 해야 요청이 사라지지 않는다.
  api.onFileOpenRequested((path) => void workspace.openRequestedFile(path))
  const requestedFile = await api.takeRequestedFile()
  if (requestedFile) await workspace.openRequestedFile(requestedFile)
  else if (!restored) await workspace.reopen(startupOpenFiles)

  const paneCount = panes.all().length
  paneWidths = startupPaneWidths.length === paneCount ? [...startupPaneWidths] : equalWidths(paneCount)
  renderPanes()
  startupFinished = true
  updateSettings({ openFiles: openFilePaths(), paneWidths })

  autosave.start()
  panes.focused().focus()
}
