import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { BackupSet, Eol, PaneBackup } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { createSerialQueue } from './serial-queue'

export type BackupStore = {
  write(backup: BackupSet): Promise<void>
  read(): Promise<BackupSet | null>
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
          return backupSetFrom(JSON.parse(await readFile(filePath, 'utf8')))
        } catch {
          return null
        }
      }),
    clear: () => queue.run(() => rm(filePath, { force: true })),
  }
}

type LegacyBackup = { path: string | null; content: string; eol: Eol; savedAt: string }

function backupSetFrom(value: unknown): BackupSet | null {
  if (isBackupSet(value)) return value
  // 나란히 쓰기 이전 버전은 문서 하나만 { path, content, eol, savedAt } 형식으로 백업했다.
  if (isLegacyBackup(value)) {
    return { savedAt: value.savedAt, panes: [{ path: value.path, eol: value.eol, unsavedContent: value.content }] }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isEol = (value: unknown): value is Eol => value === 'lf' || value === 'crlf'
const isPathOrNull = (value: unknown) => value === null || typeof value === 'string'

function isPaneBackup(value: unknown): value is PaneBackup {
  return (
    isRecord(value) &&
    isPathOrNull(value.path) &&
    isEol(value.eol) &&
    (value.unsavedContent === null || typeof value.unsavedContent === 'string')
  )
}

function isBackupSet(value: unknown): value is BackupSet {
  return (
    isRecord(value) &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.panes) &&
    value.panes.length > 0 &&
    value.panes.every(isPaneBackup)
  )
}

function isLegacyBackup(value: unknown): value is LegacyBackup {
  return (
    isRecord(value) &&
    isPathOrNull(value.path) &&
    typeof value.content === 'string' &&
    isEol(value.eol) &&
    typeof value.savedAt === 'string'
  )
}
