import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { BackupSet, Eol, PaneBackup } from '../shared/types'
import { retryWhileLocked, writeFileAtomic } from './atomic-write'
import { errorCode } from './fs-errors'
import { createSerialQueue } from './serial-queue'

export type BackupStore = {
  write(backup: BackupSet): Promise<void>
  // 백업이 없으면 null이다. 다시 시도해도 읽지 못하면 실패를 알린다. 없다고 하면 앱이 백업을 지우기 때문이다.
  read(): Promise<BackupSet | null>
  clear(): Promise<void>
}

export type BackupStoreOptions = {
  readFile?: (path: string) => Promise<string>
  retryDelayMs?: number
}

export function createBackupStore(
  directory: string,
  { readFile: readBackupFile = (path) => readFile(path, 'utf8'), retryDelayMs }: BackupStoreOptions = {},
): BackupStore {
  const filePath = join(directory, 'current.json')

  async function moveBrokenFileAside(): Promise<void> {
    await retryWhileLocked(() => rename(filePath, join(directory, 'current.bad.json')), { retryDelayMs })
  }

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
        let raw: string
        try {
          raw = await retryWhileLocked(() => readBackupFile(filePath), { retryDelayMs })
        } catch (error) {
          if (errorCode(error) === 'ENOENT') return null
          throw error
        }
        const backup = parseBackupSet(raw)
        if (!backup) await moveBrokenFileAside()
        return backup
      }),
    clear: () => queue.run(() => rm(filePath, { force: true })),
  }
}

function parseBackupSet(raw: string): BackupSet | null {
  try {
    return backupSetFrom(JSON.parse(raw))
  } catch {
    return null
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
