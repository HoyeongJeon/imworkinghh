import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Backup } from '../shared/types'
import { writeFileAtomic } from './atomic-write'

export type BackupStore = {
  write(backup: Backup): Promise<void>
  read(): Promise<Backup | null>
  clear(): Promise<void>
}

export function createBackupStore(directory: string): BackupStore {
  const filePath = join(directory, 'current.json')
  return {
    async write(backup) {
      await mkdir(directory, { recursive: true })
      await writeFileAtomic(filePath, JSON.stringify(backup))
    },
    async read() {
      try {
        const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
        return isBackup(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    async clear() {
      await rm(filePath, { force: true })
    },
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
