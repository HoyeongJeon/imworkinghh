import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackupStore } from '../../src/main/backup-store'
import type { Backup } from '../../src/shared/types'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-backup-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const sampleBackup: Backup = {
  path: 'C:\\notes\\회의록.md',
  content: '# 쓰다 만 글',
  eol: 'crlf',
  savedAt: '2026-10-08T05:00:00.000Z',
}

describe('자동 백업 저장소', () => {
  it('백업이 없으면 아무것도 돌려주지 않는다', async () => {
    expect(await createBackupStore(join(directory, 'backup')).read()).toBeNull()
  })

  it('쓴 백업을 그대로 다시 읽는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    expect(await store.read()).toEqual(sampleBackup)
  })

  it('새 문서의 백업은 경로 없이 저장된다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write({ ...sampleBackup, path: null })
    expect((await store.read())?.path).toBeNull()
  })

  it('지우면 다음에 읽을 때 없다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    await store.clear()
    expect(await store.read()).toBeNull()
  })

  it('지울 백업이 없어도 오류를 내지 않는다', async () => {
    await expect(createBackupStore(join(directory, 'backup')).clear()).resolves.toBeUndefined()
  })

  it('깨진 백업 파일은 없는 것으로 본다', async () => {
    const backupDirectory = join(directory, 'backup')
    await mkdir(backupDirectory)
    await writeFile(join(backupDirectory, 'current.json'), '{"content": 1}')
    expect(await createBackupStore(backupDirectory).read()).toBeNull()
  })
})
