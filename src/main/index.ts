import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function openWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(openWindow)
app.on('window-all-closed', () => app.quit())
