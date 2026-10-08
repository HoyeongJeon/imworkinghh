import { ipcMain, type BrowserWindow } from 'electron'
import type { SaveRequest } from '../shared/api'
import { IpcChannel } from '../shared/ipc-channels'
import type { Backup, Settings } from '../shared/types'
import type { BackupStore } from './backup-store'
import type { AppDialogs } from './dialogs'
import type { FileService } from './file-service'
import type { OpenRequestQueue } from './open-requests'
import type { SettingsStore } from './settings-store'

export type IpcDeps = {
  window: BrowserWindow
  fileService: FileService
  settingsStore: SettingsStore
  backupStore: BackupStore
  dialogs: AppDialogs
  openRequests: OpenRequestQueue
  closeWindowNow(): void
}

export function registerIpcHandlers(deps: IpcDeps): void {
  const { window, fileService, settingsStore, backupStore, dialogs } = deps

  ipcMain.handle(IpcChannel.loadSettings, () => settingsStore.load())
  ipcMain.handle(IpcChannel.saveSettings, (_event, settings: Settings) => settingsStore.save(settings))
  ipcMain.handle(IpcChannel.openFileDialog, (_event, defaultDirectory: string | null) =>
    fileService.openWithDialog(defaultDirectory),
  )
  ipcMain.handle(IpcChannel.openPath, (_event, path: string, options?: { reportErrors?: boolean }) =>
    fileService.openPath(path, options),
  )
  ipcMain.handle(IpcChannel.takeRequestedFile, () => deps.openRequests.takePending())
  ipcMain.handle(IpcChannel.saveFile, (_event, request: SaveRequest) => fileService.save(request))
  ipcMain.handle(IpcChannel.confirmDiscard, () => dialogs.confirmDiscard())
  ipcMain.handle(IpcChannel.askRestoreBackup, (_event, savedAt: string) => dialogs.askRestoreBackup(savedAt))
  ipcMain.handle(IpcChannel.readBackup, () => backupStore.read())
  ipcMain.handle(IpcChannel.writeBackup, (_event, backup: Backup) => backupStore.write(backup))
  ipcMain.handle(IpcChannel.clearBackup, () => backupStore.clear())

  ipcMain.on(IpcChannel.requestClose, () => window.close())
  ipcMain.on(IpcChannel.closeNow, () => deps.closeWindowNow())
  ipcMain.on(IpcChannel.minimize, () => window.minimize())
  ipcMain.on(IpcChannel.toggleMaximize, () => (window.isMaximized() ? window.unmaximize() : window.maximize()))
}
