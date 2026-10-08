import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { WindowBounds } from '../shared/types'

export type MainWindowOptions = { platform: string; bounds: WindowBounds | null; preloadPath: string }

export function createMainWindow({ platform, bounds, preloadPath }: MainWindowOptions): BrowserWindow {
  const isMac = platform === 'darwin'
  const window = new BrowserWindow({
    ...(bounds ?? { width: 1100, height: 760 }),
    minWidth: 480,
    minHeight: 360,
    show: false,
    backgroundColor: '#0C0C0C',
    // Windows는 제목줄을 직접 그리고, macOS는 신호등 버튼만 남긴다.
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // 파일을 창에 놓거나 링크가 열리면 Chromium이 앱 화면을 다른 페이지로 바꿔서 쓰던 글이 사라진다.
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.once('ready-to-show', () => window.show())
  return window
}

export function loadRenderer(window: BrowserWindow, rendererDirectory: string): void {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
    if (process.env['IMWORKING_DEVTOOLS'] === '1') window.webContents.openDevTools({ mode: 'detach' })
    return
  }
  void window.loadFile(join(rendererDirectory, 'index.html'))
}
