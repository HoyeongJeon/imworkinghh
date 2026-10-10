import { isSamePath } from '../shared/panes'
import type { BackupSet, PaneBackup } from '../shared/types'
import type { CommandLock } from './command-lock'
import type { DocumentCommands } from './document-commands'
import type { PaneSet } from './pane-set'

export type WorkspacePane = {
  filePath(): string | null
  isDirty(): boolean
  focus(): void
  commands: Pick<DocumentCommands, 'confirmClose' | 'openPath' | 'openRequestedFile' | 'restore'>
}

export type WorkspaceCommands = {
  addPane(): boolean
  closeFocusedPane(): Promise<boolean>
  closeWindow(): Promise<boolean>
  focusPaneWithFile(path: string, except: WorkspacePane): boolean
  openRequestedFile(path: string, target?: WorkspacePane): Promise<boolean>
  restore(backup: BackupSet): Promise<void>
  reopen(paths: readonly string[]): Promise<void>
}

export type WorkspaceDeps = {
  panes: PaneSet<WorkspacePane>
  maxPanes: number
  lock: CommandLock
  onBackupStale(): void
  clearBackup(): Promise<void>
  closeWindowNow(): void
}

export function panesToRestore(panes: readonly PaneBackup[], maxPanes: number): PaneBackup[] {
  if (panes.length <= maxPanes) return [...panes]
  const unsavedFirst = [
    ...panes.filter((pane) => pane.unsavedContent !== null),
    ...panes.filter((pane) => pane.unsavedContent === null),
  ]
  const kept = new Set(unsavedFirst.slice(0, maxPanes))
  return panes.filter((pane) => kept.has(pane))
}

export function createWorkspaceCommands(deps: WorkspaceDeps): WorkspaceCommands {
  const { panes } = deps

  function focus(pane: WorkspacePane): void {
    panes.focus(pane)
    pane.focus()
  }

  return {
    addPane() {
      const pane = panes.add()
      if (!pane) return false
      pane.focus()
      return true
    },

    async closeFocusedPane() {
      if (panes.all().length === 1) return false
      const pane = panes.focused()
      if (!(await pane.commands.confirmClose())) return false
      panes.remove(pane)
      panes.focused().focus()
      deps.onBackupStale()
      return true
    },

    async closeWindow() {
      for (const pane of [...panes.all()]) {
        if (pane.isDirty()) focus(pane)
        if (!(await pane.commands.confirmClose())) return false
      }
      await deps.clearBackup()
      deps.closeWindowNow()
      return true
    },

    focusPaneWithFile(path, except) {
      const pane = panes.all().find((candidate) => {
        const candidatePath = candidate.filePath()
        return candidate !== except && candidatePath !== null && isSamePath(candidatePath, path)
      })
      if (!pane) return false
      focus(pane)
      return true
    },

    // 진행 중인 명령(예: 칸 닫기 확인)을 기다리는 동안 대상 칸이 닫힐 수 있으므로, 열 칸은 기다린 뒤에 고른다.
    openRequestedFile: deps.lock.afterRunning(async (path: string, target?: WorkspacePane) => {
      const pane = target && panes.all().includes(target) ? target : panes.focused()
      if (pane !== panes.focused()) focus(pane)
      return pane.commands.openRequestedFile(path)
    }),

    async restore(backup) {
      for (const [index, paneBackup] of panesToRestore(backup.panes, deps.maxPanes).entries()) {
        const pane = index === 0 ? panes.focused() : panes.add()
        if (!pane) break
        await pane.commands.restore(paneBackup)
      }
      focus(panes.all()[0])
    },

    async reopen(paths) {
      let opened = 0
      for (const path of paths) {
        const pane = opened === 0 ? panes.focused() : panes.add()
        if (!pane) break
        if (await pane.commands.openPath(path)) opened++
        else if (opened > 0) panes.remove(pane)
      }
      focus(panes.all()[0])
    },
  }
}
