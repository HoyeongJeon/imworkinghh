import { contextBridge, ipcRenderer } from 'electron'
import type { ImworkingApi } from '../shared/api'
import { defaultEol } from '../shared/eol'
import { IpcChannel } from '../shared/ipc-channels'

const api: ImworkingApi = {
  platform: process.platform,
  defaultEol: defaultEol(process.platform),
  loadSettings: () => ipcRenderer.invoke(IpcChannel.loadSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IpcChannel.saveSettings, settings),
  openFileDialog: (defaultDirectory) => ipcRenderer.invoke(IpcChannel.openFileDialog, defaultDirectory),
  openPath: (path) => ipcRenderer.invoke(IpcChannel.openPath, path),
  saveFile: (request) => ipcRenderer.invoke(IpcChannel.saveFile, request),
  confirmDiscard: () => ipcRenderer.invoke(IpcChannel.confirmDiscard),
  askRestoreBackup: (savedAt) => ipcRenderer.invoke(IpcChannel.askRestoreBackup, savedAt),
  readBackup: () => ipcRenderer.invoke(IpcChannel.readBackup),
  writeBackup: (backup) => ipcRenderer.invoke(IpcChannel.writeBackup, backup),
  clearBackup: () => ipcRenderer.invoke(IpcChannel.clearBackup),
  onCloseRequested: (listener) => {
    ipcRenderer.on(IpcChannel.closeRequested, () => listener())
  },
  requestCloseWindow: () => ipcRenderer.send(IpcChannel.requestClose),
  closeWindowNow: () => ipcRenderer.send(IpcChannel.closeNow),
  minimizeWindow: () => ipcRenderer.send(IpcChannel.minimize),
  toggleMaximizeWindow: () => ipcRenderer.send(IpcChannel.toggleMaximize),
}

contextBridge.exposeInMainWorld('imworking', api)
