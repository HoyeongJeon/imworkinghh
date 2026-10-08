import { Menu } from 'electron'

export function applyAppMenu(platform: string): void {
  if (platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  // 되돌리기는 메뉴에 넣지 않는다. 메뉴 단축키가 먼저 잡으면 에디터의 되돌리기 기록이 동작하지 않는다.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { role: 'windowMenu' },
    ]),
  )
}
