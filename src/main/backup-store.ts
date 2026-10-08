import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Backup } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { createSerialQueue } from './serial-queue'

export type BackupStore = {
  write(backup: Backup): Promise<void>
  read(): Promise<Backup | null>
  clear(): Promise<void>
}

export function createBackupStore(directory: string): BackupStore {
  const filePath = join(directory, 'current.json')
  // 저장 직전에 시작된 자동 백업이 저장 뒤의 지우기보다 늦게 끝나면 저장한 글이 백업으로 남으므로 순서대로 처리한다.
  const queue = createSerialQueue()
  return {
    write: (backup) =>
      queue.run(async () => {
        await mkdir(directory, { recursive: true })
        await writeFileAtomic(filePath, JSON.stringify(backup))
      }),
    read: () =>
      queue.run(async () => {
        try {
          const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
          return isBackup(parsed) ? parsed : null
        } catch {
          return null
        }
      }),
    clear: () => queue.run(() => rm(filePath, { force: true })),
  }
}

function isBackup(value: unknown): value is Backup {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.path === null || typeof candidate.path === 'string') &&
    typeof candidate.content === 'string' &&
    (candidate.eol === 'lf' || candidate.eol === 'crlf') &&
    typeof candidate.savedAt === 'string'
  )
}
