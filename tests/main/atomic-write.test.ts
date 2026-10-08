import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic, type AtomicWriteFs } from '../../src/main/atomic-write'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-atomic-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function createFakeFs(renameErrorCodes: string[]) {
  const calls: string[] = []
  const fs: AtomicWriteFs = {
    writeFile: async (path) => {
      calls.push(`writeFile ${path}`)
    },
    rename: async () => {
      calls.push('rename')
      const code = renameErrorCodes.shift()
      if (code) throw Object.assign(new Error(code), { code })
    },
    rm: async (path) => {
      calls.push(`rm ${path}`)
    },
  }
  return { fs, calls }
}

describe('안전한 파일 쓰기', () => {
  it('새 파일에 내용을 쓴다', async () => {
    const target = join(directory, 'note.md')
    await writeFileAtomic(target, '# 새 글')
    expect(await readFile(target, 'utf8')).toBe('# 새 글')
  })

  it('기존 파일을 새 내용으로 바꾼다', async () => {
    const target = join(directory, 'note.md')
    await writeFile(target, '예전 내용')
    await writeFileAtomic(target, '새 내용')
    expect(await readFile(target, 'utf8')).toBe('새 내용')
  })

  it('저장이 끝나면 임시 파일을 남기지 않는다', async () => {
    await writeFileAtomic(join(directory, 'note.md'), '내용')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('한글과 공백이 들어간 경로에도 저장한다', async () => {
    const folder = join(directory, '내 문서')
    await mkdir(folder)
    const target = join(folder, '회의록 10월.md')
    await writeFileAtomic(target, '안건')
    expect(await readFile(target, 'utf8')).toBe('안건')
  })

  it('파일이 잠깐 잠겨 있으면 다시 시도해서 저장한다', async () => {
    const { fs, calls } = createFakeFs(['EBUSY', 'EBUSY'])
    await writeFileAtomic('/notes/a.md', '내용', { fs, retryDelayMs: 0 })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(3)
  })

  it('계속 잠겨 있으면 임시 파일을 지우고 실패를 알린다', async () => {
    const { fs, calls } = createFakeFs(Array(10).fill('EBUSY'))
    await expect(
      writeFileAtomic('/notes/a.md', '내용', { fs, retries: 5, retryDelayMs: 0 }),
    ).rejects.toMatchObject({ code: 'EBUSY' })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(6)
    expect(calls.at(-1)).toMatch(/^rm .*\.tmp$/)
  })

  it('잠금이 아닌 오류는 다시 시도하지 않는다', async () => {
    const { fs, calls } = createFakeFs(['ENOSPC'])
    await expect(writeFileAtomic('/notes/a.md', '내용', { fs, retryDelayMs: 0 })).rejects.toMatchObject({
      code: 'ENOSPC',
    })
    expect(calls.filter((call) => call === 'rename')).toHaveLength(1)
  })
})
