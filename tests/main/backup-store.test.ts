import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackupStore } from '../../src/main/backup-store'
import type { BackupSet } from '../../src/shared/types'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-backup-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const sampleBackup: BackupSet = {
  savedAt: '2026-10-08T05:00:00.000Z',
  panes: [
    { path: 'C:\\notes\\회의록.md', eol: 'crlf', unsavedContent: '# 쓰다 만 글' },
    { path: 'C:\\notes\\요약.md', eol: 'crlf', unsavedContent: null },
  ],
}

async function writeRawBackup(content: string): Promise<string> {
  const backupDirectory = join(directory, 'backup')
  await mkdir(backupDirectory)
  await writeFile(join(backupDirectory, 'current.json'), content)
  return backupDirectory
}

describe('자동 백업 저장소', () => {
  it('백업이 없으면 아무것도 돌려주지 않는다', async () => {
    expect(await createBackupStore(join(directory, 'backup')).read()).toBeNull()
  })

  it('쓴 백업을 칸 순서 그대로 다시 읽는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write(sampleBackup)
    expect(await store.read()).toEqual(sampleBackup)
  })

  it('새 문서 칸의 백업은 경로 없이 저장된다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    await store.write({ ...sampleBackup, panes: [{ path: null, eol: 'lf', unsavedContent: '새 글' }] })
    expect((await store.read())?.panes[0].path).toBeNull()
  })

  it('예전 형식의 백업은 칸 하나짜리 백업으로 읽는다', async () => {
    const backupDirectory = await writeRawBackup(
      JSON.stringify({ path: 'C:\\notes\\a.md', content: '# 예전 글', eol: 'lf', savedAt: '2026-10-08T05:00:00.000Z' }),
    )
    expect(await createBackupStore(backupDirectory).read()).toEqual({
      savedAt: '2026-10-08T05:00:00.000Z',
      panes: [{ path: 'C:\\notes\\a.md', eol: 'lf', unsavedContent: '# 예전 글' }],
    })
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
    const backupDirectory = await writeRawBackup('{"content": 1}')
    expect(await createBackupStore(backupDirectory).read()).toBeNull()
  })

  it('칸 목록이 비었거나 칸 정보가 틀린 백업은 없는 것으로 본다', async () => {
    const empty = await writeRawBackup(JSON.stringify({ savedAt: '2026-10-08T05:00:00.000Z', panes: [] }))
    expect(await createBackupStore(empty).read()).toBeNull()
    await writeFile(
      join(empty, 'current.json'),
      JSON.stringify({ savedAt: '2026-10-08T05:00:00.000Z', panes: [{ path: 1, eol: 'lf', unsavedContent: null }] }),
    )
    expect(await createBackupStore(empty).read()).toBeNull()
  })

  it('쓰는 중에 지우라고 하면 쓰기가 끝난 뒤에 지워서 백업이 남지 않는다', async () => {
    const store = createBackupStore(join(directory, 'backup'))
    const writing = store.write(sampleBackup)
    await store.clear()
    await writing
    expect(await store.read()).toBeNull()
  })
})
