import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { createBackupStore } from './backup-store'
import { installCloseGuard } from './close-guard'
import { createElectronDialogs } from './dialogs'
import { createFileService } from './file-service'
import { registerIpcHandlers } from './ipc'
import { filePathFromArgs } from './launch-args'
import { applyAppMenu } from './menu'
import { createOpenRequestQueue } from './open-requests'
import { createSettingsStore } from './settings-store'
import { createMainWindow, loadRenderer } from './window'
import { boundsIfVisible } from './window-bounds'
import { IpcChannel } from '../shared/ipc-channels'

let mainWindow: BrowserWindow | null = null
const openRequests = createOpenRequestQueue((path) => mainWindow?.webContents.send(IpcChannel.fileOpenRequested, path))

async function startApp(): Promise<void> {
  const platform = process.platform
  const userData = app.getPath('userData')
  const settingsStore = createSettingsStore({ filePath: join(userData, 'settings.json'), platform })
  const backupStore = createBackupStore(join(userData, 'backup'))
  const settings = await settingsStore.load()

  applyAppMenu(platform)
  const workAreas = screen.getAllDisplays().map((display) => display.workArea)
  const window = createMainWindow({
    platform,
    bounds: boundsIfVisible(settings.windowBounds, workAreas),
    preloadPath: join(__dirname, '../preload/index.js'),
  })
  mainWindow = window

  const dialogs = createElectronDialogs(window)
  const closeGuard = installCloseGuard(window, async () => {
    const latest = await settingsStore.load()
    await settingsStore.save({ ...latest, windowBounds: window.getNormalBounds() })
  })
  registerIpcHandlers({
    window,
    fileService: createFileService({ dialogs, platform }),
    settingsStore,
    backupStore,
    dialogs,
    openRequests,
    closeWindowNow: closeGuard.closeNow,
  })
  loadRenderer(window, join(__dirname, '../renderer'))
}

// 두 개를 띄우면 같은 백업 파일을 서로 덮어쓰므로 하나만 실행한다.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  const launchPath = filePathFromArgs(process.argv)
  if (launchPath) openRequests.request(launchPath)
  app.on('open-file', (event, path) => {
    event.preventDefault()
    openRequests.request(path)
  })
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const path = filePathFromArgs(argv)
    if (path) openRequests.request(path)
  })
  app.whenReady().then(startApp)
  app.on('window-all-closed', () => app.quit())
}
