import type { BackupSet, PaneBackup } from '../shared/types'

export const AUTOSAVE_INTERVAL_MS = 30_000

export type Autosave = {
  start(): void
  stop(): void
  flushNow(): Promise<void>
}

export type AutosaveOptions = {
  intervalMs?: number
  takeSnapshot(): BackupSet | null
  writeBackup(backup: BackupSet): Promise<void>
  clearBackup(): Promise<void>
}

export function unsavedPaneCount(backup: BackupSet): number {
  return backup.panes.filter((pane) => pane.unsavedContent !== null).length
}

export function backupSetOf(panes: PaneBackup[], savedAt: string): BackupSet | null {
  const backup = { savedAt, panes }
  return unsavedPaneCount(backup) > 0 ? backup : null
}

const CLEARED = 'cleared'
type DiskBackup = PaneBackup[] | typeof CLEARED

export function createAutosave({
  intervalMs = AUTOSAVE_INTERVAL_MS,
  takeSnapshot,
  writeBackup,
  clearBackup,
}: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setInterval> | null = null
  // 디스크에 있는 백업과 같으면 다시 쓰지 않는다. null이면 디스크 상태를 모른다.
  let lastWritten: DiskBackup | null = null

  async function backupIfChanged(): Promise<void> {
    const snapshot = takeSnapshot()
    const next: DiskBackup = snapshot ? snapshot.panes : CLEARED
    if (lastWritten !== null && isSameBackup(lastWritten, next)) return
    lastWritten = next
    try {
      if (snapshot) await writeBackup(snapshot)
      else await clearBackup()
    } catch {
      lastWritten = null
    }
  }

  return {
    start() {
      if (!timer) timer = setInterval(() => void backupIfChanged(), intervalMs)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    flushNow: backupIfChanged,
  }
}

function isSameBackup(a: DiskBackup, b: DiskBackup): boolean {
  if (a === CLEARED || b === CLEARED) return a === b
  return (
    a.length === b.length &&
    a.every(
      (pane, index) =>
        pane.path === b[index].path && pane.eol === b[index].eol && pane.unsavedContent === b[index].unsavedContent,
    )
  )
}
