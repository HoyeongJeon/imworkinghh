import type { Backup } from '../shared/types'

export const AUTOSAVE_INTERVAL_MS = 30_000

export type Autosave = {
  start(): void
  stop(): void
  forgetLastBackup(): void
}

export type AutosaveOptions = {
  intervalMs?: number
  takeSnapshot(): Backup | null
  writeBackup(backup: Backup): Promise<void>
}

export function createAutosave({ intervalMs = AUTOSAVE_INTERVAL_MS, takeSnapshot, writeBackup }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setInterval> | null = null
  let lastWritten: { path: string | null; content: string } | null = null

  async function backupIfChanged(): Promise<void> {
    const snapshot = takeSnapshot()
    if (!snapshot) return
    const unchanged = lastWritten?.content === snapshot.content && lastWritten.path === snapshot.path
    if (unchanged) return
    lastWritten = { path: snapshot.path, content: snapshot.content }
    try {
      await writeBackup(snapshot)
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
    forgetLastBackup() {
      lastWritten = null
    },
  }
}
