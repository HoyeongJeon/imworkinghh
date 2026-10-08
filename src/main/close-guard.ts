import type { BrowserWindow } from 'electron'
import { IpcChannel } from '../shared/ipc-channels'

export type CloseGuard = { closeNow(): void }

export function installCloseGuard(window: BrowserWindow, beforeClose: () => Promise<void>): CloseGuard {
  let closeConfirmed = false

  window.on('close', (event) => {
    if (closeConfirmed) return
    event.preventDefault()
    window.webContents.send(IpcChannel.closeRequested)
  })

  // 화면 프로세스가 죽으면 저장 확인에 답할 수 없으므로 그냥 닫게 둔다.
  window.webContents.on('render-process-gone', () => {
    closeConfirmed = true
  })

  return {
    closeNow() {
      closeConfirmed = true
      void beforeClose()
        .catch(() => undefined)
        .finally(() => window.close())
    },
  }
}
