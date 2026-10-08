import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readDocument, writeDocument } from '../../src/main/documents'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-docs-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('문서 읽기', () => {
  it('CRLF 파일을 읽으면 편집용 LF 글과 원래 줄바꿈 방식을 함께 돌려준다', async () => {
    const path = join(directory, 'a.md')
    await writeFile(path, '첫 줄\r\n둘째 줄\r\n')
    expect(await readDocument(path)).toEqual({
      status: 'ok',
      text: '첫 줄\n둘째 줄\n',
      eol: 'crlf',
      encoding: 'utf-8',
    })
  })

  it('CP949 파일을 읽으면 원래 인코딩을 알려 준다', async () => {
    const path = join(directory, 'old.txt')
    await writeFile(path, new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]))
    expect(await readDocument(path)).toMatchObject({ status: 'ok', text: '한글', encoding: 'cp949' })
  })

  it('크기 제한보다 큰 파일은 읽지 않고 크기를 알려 준다', async () => {
    const path = join(directory, 'big.md')
    await writeFile(path, 'hello world')
    expect(await readDocument(path, { maxBytes: 4 })).toEqual({ status: 'tooLarge', bytes: 11 })
  })

  it('크기 제한을 풀면 큰 파일도 읽는다', async () => {
    const path = join(directory, 'big.md')
    await writeFile(path, 'hello world')
    expect(await readDocument(path, { maxBytes: Infinity })).toMatchObject({ status: 'ok', text: 'hello world' })
  })

  it('없는 파일을 읽으면 찾을 수 없다고 알려 준다', async () => {
    const result = await readDocument(join(directory, 'missing.md'))
    expect(result.status).toBe('failed')
    expect(result.status === 'failed' && result.message).toContain('찾을 수 없습니다')
  })
})

describe('문서 쓰기', () => {
  it('CRLF 문서는 CRLF 줄바꿈으로 저장한다', async () => {
    const path = join(directory, 'a.md')
    await writeDocument({ path, text: 'a\nb\n', eol: 'crlf' })
    expect(await readFile(path, 'utf8')).toBe('a\r\nb\r\n')
  })

  it('저장은 BOM 없는 UTF-8로 한다', async () => {
    const path = join(directory, 'a.md')
    await writeDocument({ path, text: '한', eol: 'lf' })
    expect(Array.from(await readFile(path))).toEqual([0xed, 0x95, 0x9c])
  })

  it('쓰기에 실패하면 이유를 알려 준다', async () => {
    const failingWrite = async () => {
      throw Object.assign(new Error('full'), { code: 'ENOSPC' })
    }
    const result = await writeDocument({ path: '/x/a.md', text: 'a', eol: 'lf' }, failingWrite)
    expect(result).toEqual({ status: 'failed', message: '디스크 공간이 부족합니다.' })
  })
})
