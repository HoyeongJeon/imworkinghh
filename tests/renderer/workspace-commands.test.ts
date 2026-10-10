import { describe, expect, it } from 'vitest'
import { createCommandLock } from '../../src/renderer/command-lock'
import { createPaneSet } from '../../src/renderer/pane-set'
import { createWorkspaceCommands, panesToRestore, type WorkspacePane } from '../../src/renderer/workspace-commands'
import type { PaneBackup } from '../../src/shared/types'

type FakePaneState = {
  path: string | null
  dirty: boolean
  closeAnswer: boolean
  // 정하면 저장 확인 대화 상자가 떠 있는 것처럼 이 약속이 끝날 때까지 답하지 않는다.
  closeDialog: Promise<void> | null
  openDialog: Promise<void> | null
}

type FakePane = WorkspacePane & { name: string; state: FakePaneState }

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => (resolve = done))
  return { promise, resolve }
}

function setup({ maxPanes = 2 } = {}) {
  const log: string[] = []
  const missing = new Set<string>()
  const lock = createCommandLock()
  let created = 0

  function createFakePane(): FakePane {
    const name = `pane${++created}`
    const state: FakePaneState = { path: null, dirty: false, closeAnswer: true, closeDialog: null, openDialog: null }
    return {
      name,
      state,
      filePath: () => state.path,
      isDirty: () => state.dirty,
      focus: () => log.push(`${name} focus`),
      commands: {
        confirmClose: lock.unlessBusy(async () => {
          log.push(`${name} confirmClose`)
          if (state.closeDialog) await state.closeDialog
          return state.closeAnswer
        }),
        openPath: async (path) => {
          log.push(`${name} openPath ${path}`)
          if (missing.has(path)) return false
          state.path = path
          return true
        },
        openRequestedFile: async (path) => {
          log.push(`${name} openRequestedFile ${path}`)
          if (state.openDialog) await state.openDialog
          state.path = path
          return true
        },
        restore: async (backup) => {
          log.push(`${name} restore ${backup.unsavedContent ?? backup.path}`)
          if (backup.unsavedContent === null && backup.path !== null && missing.has(backup.path)) return false
          state.path = backup.path
          state.dirty = backup.unsavedContent !== null
          return true
        },
      },
    }
  }

  const panes = createPaneSet<FakePane>({
    maxPanes,
    createPane: createFakePane,
    destroyPane: (pane) => log.push(`${pane.name} destroy`),
    onChanged: () => undefined,
  })
  const workspace = createWorkspaceCommands({
    panes,
    maxPanes,
    lock,
    onBackupStale: () => log.push('backupStale'),
    clearBackup: async () => {
      log.push('clearBackup')
    },
    closeWindowNow: () => log.push('closeWindowNow'),
  })
  const names = () => panes.all().map((pane) => pane.name)
  const paneNamed = (name: string) => panes.all().find((pane) => pane.name === name)!
  const logFrom = (start: number) => log.slice(start)
  return { panes, workspace, lock, log, missing, names, paneNamed, logFrom }
}

const pane = (path: string | null, unsavedContent: string | null): PaneBackup => ({ path, eol: 'lf', unsavedContent })

describe('칸 더하기와 닫기', () => {
  it('칸을 더하면 새 칸으로 커서를 옮긴다', () => {
    const { workspace, names, log } = setup()
    expect(workspace.addPane()).toBe(true)
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log.at(-1)).toBe('pane2 focus')
  })

  it('최대 칸 수면 칸을 더하지 않는다', () => {
    const { workspace, names } = setup({ maxPanes: 2 })
    workspace.addPane()
    expect(workspace.addPane()).toBe(false)
    expect(names()).toEqual(['pane1', 'pane2'])
  })

  it('칸이 하나뿐이면 닫지 않는다', async () => {
    const { workspace, log } = setup()
    expect(await workspace.closeFocusedPane()).toBe(false)
    expect(log).not.toContain('pane1 confirmClose')
  })

  it('지금 칸을 닫으면 저장 확인을 거쳐 없애고 남은 칸으로 커서를 옮긴 뒤 백업을 고쳐 쓰게 한다', async () => {
    const { workspace, names, log, logFrom } = setup()
    workspace.addPane()
    const start = log.length
    expect(await workspace.closeFocusedPane()).toBe(true)
    expect(names()).toEqual(['pane1'])
    expect(logFrom(start)).toEqual(['pane2 confirmClose', 'pane2 destroy', 'pane1 focus', 'backupStale'])
  })

  it('닫기 확인에서 취소하면 칸을 닫지 않는다', async () => {
    const { workspace, names, paneNamed, log } = setup()
    workspace.addPane()
    paneNamed('pane2').state.closeAnswer = false
    expect(await workspace.closeFocusedPane()).toBe(false)
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log).not.toContain('backupStale')
  })
})

describe('창 닫기', () => {
  it('저장 안 한 칸마다 왼쪽부터 그 칸으로 옮겨 묻고, 모두 정리되면 백업을 지우고 닫는다', async () => {
    const { workspace, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    paneNamed('pane1').state.dirty = true
    paneNamed('pane2').state.dirty = true
    const start = log.length
    expect(await workspace.closeWindow()).toBe(true)
    expect(logFrom(start)).toEqual([
      'pane1 focus',
      'pane1 confirmClose',
      'pane2 focus',
      'pane2 confirmClose',
      'clearBackup',
      'closeWindowNow',
    ])
  })

  it('변경 없는 칸은 그 칸으로 옮기지 않는다', async () => {
    const { workspace, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    paneNamed('pane2').state.dirty = true
    const start = log.length
    await workspace.closeWindow()
    expect(logFrom(start)).toEqual(['pane1 confirmClose', 'pane2 focus', 'pane2 confirmClose', 'clearBackup', 'closeWindowNow'])
  })

  it('어느 칸에서든 취소하면 창을 닫지 않고 남은 칸은 묻지 않는다', async () => {
    const { workspace, paneNamed, log } = setup()
    workspace.addPane()
    paneNamed('pane1').state.dirty = true
    paneNamed('pane1').state.closeAnswer = false
    paneNamed('pane2').state.dirty = true
    expect(await workspace.closeWindow()).toBe(false)
    expect(log).not.toContain('pane2 confirmClose')
    expect(log).not.toContain('clearBackup')
    expect(log).not.toContain('closeWindowNow')
  })
})

describe('같은 파일 찾기', () => {
  it('다른 칸에 같은 파일이 열려 있으면 대소문자가 달라도 그 칸으로 옮긴다', () => {
    const { workspace, panes, paneNamed, log } = setup()
    paneNamed('pane1').state.path = 'C:\\notes\\a.md'
    workspace.addPane()
    expect(workspace.focusPaneWithFile('c:\\NOTES\\A.md', paneNamed('pane2'))).toBe(true)
    expect(panes.focused()).toBe(paneNamed('pane1'))
    expect(log.at(-1)).toBe('pane1 focus')
  })

  it('그 파일을 연 칸이 자기 칸뿐이면 찾지 못한다', () => {
    const { workspace, paneNamed } = setup()
    paneNamed('pane1').state.path = 'C:\\notes\\a.md'
    expect(workspace.focusPaneWithFile('C:\\notes\\a.md', paneNamed('pane1'))).toBe(false)
  })

  it('아무 칸에도 없는 파일은 찾지 못한다', () => {
    const { workspace, paneNamed } = setup()
    workspace.addPane()
    expect(workspace.focusPaneWithFile('C:\\notes\\b.md', paneNamed('pane2'))).toBe(false)
  })
})

describe('다른 프로그램에서 연 파일', () => {
  it('대상 칸을 정하지 않으면 지금 칸에 연다', async () => {
    const { workspace, log } = setup()
    await workspace.openRequestedFile('C:\\notes\\a.md')
    expect(log.at(-1)).toBe('pane1 openRequestedFile C:\\notes\\a.md')
  })

  it('대상 칸을 정하면 그 칸으로 옮겨 연다', async () => {
    const { workspace, panes, paneNamed, log, logFrom } = setup()
    workspace.addPane()
    const start = log.length
    await workspace.openRequestedFile('C:\\notes\\a.md', paneNamed('pane1'))
    expect(logFrom(start)).toEqual(['pane1 focus', 'pane1 openRequestedFile C:\\notes\\a.md'])
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('진행 중인 명령이 있으면 끝난 뒤에 연다', async () => {
    const { workspace, paneNamed, log } = setup()
    const dialog = deferred()
    paneNamed('pane1').state.closeDialog = dialog.promise
    const confirming = paneNamed('pane1').commands.confirmClose()
    const opening = workspace.openRequestedFile('C:\\notes\\a.md')
    await Promise.resolve()
    expect(log).not.toContain('pane1 openRequestedFile C:\\notes\\a.md')
    dialog.resolve()
    await confirming
    expect(await opening).toBe(true)
    expect(log.at(-1)).toBe('pane1 openRequestedFile C:\\notes\\a.md')
  })

  it('파일을 여는 동안에는 다른 칸 명령을 받지 않는다', async () => {
    const { workspace, lock, paneNamed } = setup()
    const dialog = deferred()
    paneNamed('pane1').state.openDialog = dialog.promise
    const opening = workspace.openRequestedFile('C:\\notes\\a.md')
    await Promise.resolve()
    expect(await lock.unlessBusy(async () => true)()).toBe(false)
    dialog.resolve()
    expect(await opening).toBe(true)
  })

  it('칸을 닫는 동안 들어온 파일은 남은 칸에 연다', async () => {
    const { workspace, panes, names, paneNamed, log } = setup()
    workspace.addPane()
    const dialog = deferred()
    paneNamed('pane2').state.closeDialog = dialog.promise
    const closing = workspace.closeFocusedPane()
    const opening = workspace.openRequestedFile('C:\\notes\\a.md')
    await Promise.resolve()
    dialog.resolve()
    expect(await closing).toBe(true)
    expect(await opening).toBe(true)
    expect(names()).toEqual(['pane1'])
    expect(log).not.toContain('pane2 openRequestedFile C:\\notes\\a.md')
    expect(log.at(-1)).toBe('pane1 openRequestedFile C:\\notes\\a.md')
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('파일을 끌어놓은 칸이 기다리는 동안 닫히면 남은 칸에 연다', async () => {
    const { workspace, names, paneNamed, log } = setup()
    workspace.addPane()
    const dropTarget = paneNamed('pane2')
    const dialog = deferred()
    dropTarget.state.closeDialog = dialog.promise
    const closing = workspace.closeFocusedPane()
    const opening = workspace.openRequestedFile('C:\\notes\\a.md', dropTarget)
    await Promise.resolve()
    dialog.resolve()
    await closing
    expect(await opening).toBe(true)
    expect(names()).toEqual(['pane1'])
    expect(log).not.toContain('pane2 openRequestedFile C:\\notes\\a.md')
    expect(log.at(-1)).toBe('pane1 openRequestedFile C:\\notes\\a.md')
  })
})

describe('복구', () => {
  it('백업의 칸 순서대로 칸을 열어 복구하고 첫 칸으로 커서를 옮긴다', async () => {
    const { workspace, panes, names, paneNamed, log } = setup()
    await workspace.restore({ savedAt: '2026-10-09T00:00:00.000Z', panes: [pane('/a.md', '글 A'), pane('/b.md', null)] })
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(log).toContain('pane1 restore 글 A')
    expect(log).toContain('pane2 restore /b.md')
    expect(log.at(-1)).toBe('pane1 focus')
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('복구할 칸의 파일이 없어졌어도 칸은 남겨 배치를 지킨다', async () => {
    const { workspace, names, missing } = setup()
    missing.add('/b.md')
    await workspace.restore({ savedAt: '2026-10-09T00:00:00.000Z', panes: [pane('/a.md', '글 A'), pane('/b.md', null)] })
    expect(names()).toEqual(['pane1', 'pane2'])
  })

  it('백업 칸이 최대 칸 수보다 많으면 저장 안 한 칸을 우선해서 원래 순서대로 고른다', () => {
    const backups = [pane('/a.md', null), pane('/b.md', '글 B'), pane('/c.md', null), pane('/d.md', '글 D')]
    expect(panesToRestore(backups, 2).map((backup) => backup.path)).toEqual(['/b.md', '/d.md'])
    expect(panesToRestore(backups, 3).map((backup) => backup.path)).toEqual(['/a.md', '/b.md', '/d.md'])
    expect(panesToRestore(backups.slice(0, 2), 2)).toEqual(backups.slice(0, 2))
  })
})

describe('다시 열기', () => {
  it('마지막에 열려 있던 파일들을 칸 순서대로 열고 첫 칸으로 커서를 옮긴다', async () => {
    const { workspace, panes, names, paneNamed } = setup()
    await workspace.reopen(['/a.md', '/b.md'])
    expect(names()).toEqual(['pane1', 'pane2'])
    expect(paneNamed('pane1').state.path).toBe('/a.md')
    expect(paneNamed('pane2').state.path).toBe('/b.md')
    expect(panes.focused()).toBe(paneNamed('pane1'))
  })

  it('첫 파일이 없어졌으면 건너뛰고 다음 파일을 첫 칸에 연다', async () => {
    const { workspace, names, paneNamed, missing } = setup()
    missing.add('/a.md')
    await workspace.reopen(['/a.md', '/b.md'])
    expect(names()).toEqual(['pane1'])
    expect(paneNamed('pane1').state.path).toBe('/b.md')
  })

  it('둘째 파일이 없어졌으면 그 칸을 남기지 않는다', async () => {
    const { workspace, names, missing, log } = setup()
    missing.add('/gone.md')
    await workspace.reopen(['/a.md', '/gone.md'])
    expect(names()).toEqual(['pane1'])
    expect(log).toContain('pane2 destroy')
  })

  it('열 파일이 없으면 빈 칸 하나로 시작한다', async () => {
    const { workspace, names } = setup()
    await workspace.reopen([])
    expect(names()).toEqual(['pane1'])
  })

  it('최대 칸 수가 3이면 세 파일을 세 칸에 연다', async () => {
    const { workspace, names } = setup({ maxPanes: 3 })
    await workspace.reopen(['/a.md', '/b.md', '/c.md'])
    expect(names()).toEqual(['pane1', 'pane2', 'pane3'])
  })
})
