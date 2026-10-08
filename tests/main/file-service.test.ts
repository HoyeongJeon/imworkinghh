import { describe, expect, it, vi } from 'vitest'
import type { ReadDocumentResult } from '../../src/main/documents'
import { createFileService, type FileDialogs } from '../../src/main/file-service'
import type { SaveRequest } from '../../src/shared/api'

function createFakeDialogs(overrides: Partial<FileDialogs> = {}) {
  const shownErrors: string[] = []
  const dialogs: FileDialogs = {
    pickOpenPath: async () => null,
    pickSavePath: async () => null,
    confirmLargeFile: async () => false,
    confirmOverwrite: async () => false,
    showError: async (title, message) => {
      shownErrors.push(`${title}: ${message}`)
    },
    ...overrides,
  }
  return { dialogs, shownErrors }
}

const readOk =
  (text = '# 메모') =>
  async (): Promise<ReadDocumentResult> => ({ status: 'ok', text, eol: 'lf', encoding: 'utf-8' })

const savedWrite = () => vi.fn(async () => ({ status: 'saved' as const }))

const saveRequest = (overrides: Partial<SaveRequest> = {}): SaveRequest => ({
  path: null,
  text: '본문',
  eol: 'lf',
  saveAs: false,
  defaultDirectory: '/notes',
  defaultFormat: 'md',
  ...overrides,
})

describe('파일 열기', () => {
  it('열기 창에서 고른 파일을 읽어 돌려준다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.md' })
    const service = createFileService({ dialogs, platform: 'win32', read: readOk('# 메모') })
    expect(await service.openWithDialog('/notes')).toEqual({
      status: 'opened',
      file: { path: '/notes/a.md', directory: '/notes', text: '# 메모', eol: 'lf', encoding: 'utf-8', format: 'md' },
    })
  })

  it('열기 창을 취소하면 아무것도 열지 않는다', async () => {
    const read = vi.fn(readOk())
    const service = createFileService({ dialogs: createFakeDialogs().dialogs, platform: 'win32', read })
    expect(await service.openWithDialog(null)).toEqual({ status: 'canceled' })
    expect(read).not.toHaveBeenCalled()
  })

  it('줄바꿈이 없는 파일은 OS 기본 줄바꿈을 쓴다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.txt' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'ok', text: '한 줄', eol: null, encoding: 'utf-8' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result.status === 'opened' && result.file.eol).toBe('crlf')
  })

  it('큰 파일은 확인을 받은 뒤에 크기 제한 없이 읽는다', async () => {
    const { dialogs } = createFakeDialogs({
      pickOpenPath: async () => '/notes/big.md',
      confirmLargeFile: async () => true,
    })
    const read = vi
      .fn<(path: string, options?: { maxBytes?: number }) => Promise<ReadDocumentResult>>()
      .mockResolvedValueOnce({ status: 'tooLarge', bytes: 20_000_000 })
      .mockResolvedValueOnce({ status: 'ok', text: '큰 글', eol: 'lf', encoding: 'utf-8' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result.status).toBe('opened')
    expect(read).toHaveBeenLastCalledWith('/notes/big.md', { maxBytes: Infinity })
  })

  it('큰 파일 열기를 거절하면 열지 않는다', async () => {
    const { dialogs } = createFakeDialogs({ pickOpenPath: async () => '/notes/big.md' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'tooLarge', bytes: 20_000_000 })
    expect(await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)).toEqual({
      status: 'canceled',
    })
  })

  it('읽기에 실패하면 이유를 보여 주고 실패를 알린다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs({ pickOpenPath: async () => '/notes/a.md' })
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'failed', message: '권한이 없어' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openWithDialog(null)
    expect(result).toEqual({ status: 'failed', message: '권한이 없어' })
    expect(shownErrors).toEqual(['파일을 열지 못했습니다: 권한이 없어'])
  })

  it('마지막 파일 다시 열기는 실패해도 오류 창을 띄우지 않는다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs()
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'failed', message: '없음' })
    const result = await createFileService({ dialogs, platform: 'win32', read }).openPath('/notes/gone.md')
    expect(result.status).toBe('failed')
    expect(shownErrors).toEqual([])
  })

  it('다른 프로그램에서 요청한 파일은 열지 못하면 이유를 보여 준다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs()
    const read = async (): Promise<ReadDocumentResult> => ({ status: 'failed', message: '없음' })
    await createFileService({ dialogs, platform: 'win32', read }).openPath('/notes/gone.md', { reportErrors: true })
    expect(shownErrors).toEqual(['파일을 열지 못했습니다: 없음'])
  })
})

describe('파일 저장', () => {
  it('경로가 있는 문서는 창 없이 같은 경로에 저장한다', async () => {
    const pickSavePath = vi.fn(async () => null)
    const write = savedWrite()
    const service = createFileService({ dialogs: createFakeDialogs({ pickSavePath }).dialogs, platform: 'win32', write })
    const result = await service.save(saveRequest({ path: '/notes/a.md', eol: 'crlf' }))
    expect(pickSavePath).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith({ path: '/notes/a.md', text: '본문', eol: 'crlf' })
    expect(result).toEqual({ status: 'saved', path: '/notes/a.md', directory: '/notes', format: 'md' })
  })

  it('새 문서는 저장 창에서 경로를 고르고 마지막 폴더의 untitled 이름을 제안한다', async () => {
    const pickSavePath = vi.fn(async () => '/notes/new.txt')
    const service = createFileService({
      dialogs: createFakeDialogs({ pickSavePath }).dialogs,
      platform: 'win32',
      write: savedWrite(),
    })
    await service.save(saveRequest({ defaultFormat: 'txt' }))
    expect(pickSavePath).toHaveBeenCalledWith(expect.stringMatching(/notes.untitled\.txt$/), 'txt')
  })

  it('다른 이름으로 저장은 경로가 있어도 저장 창을 띄운다', async () => {
    const pickSavePath = vi.fn(async () => '/notes/copy.md')
    const service = createFileService({
      dialogs: createFakeDialogs({ pickSavePath }).dialogs,
      platform: 'win32',
      write: savedWrite(),
    })
    const result = await service.save(saveRequest({ path: '/notes/a.md', saveAs: true }))
    expect(pickSavePath).toHaveBeenCalledWith('/notes/a.md', 'md')
    expect(result).toMatchObject({ status: 'saved', path: '/notes/copy.md' })
  })

  it('저장 창을 취소하면 저장하지 않는다', async () => {
    const write = savedWrite()
    const service = createFileService({ dialogs: createFakeDialogs().dialogs, platform: 'win32', write })
    expect(await service.save(saveRequest())).toEqual({ status: 'canceled' })
    expect(write).not.toHaveBeenCalled()
  })

  it('확장자 없이 고른 경로에는 고른 형식의 확장자를 붙여 저장한다', async () => {
    const write = savedWrite()
    const dialogs = createFakeDialogs({ pickSavePath: async () => '/notes/회의록' }).dialogs
    const result = await createFileService({ dialogs, platform: 'win32', write }).save(
      saveRequest({ defaultFormat: 'txt' }),
    )
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ path: '/notes/회의록.txt' }))
    expect(result).toMatchObject({ status: 'saved', path: '/notes/회의록.txt', format: 'txt' })
  })

  it('확장자를 붙인 이름의 파일이 이미 있으면 덮어쓸지 묻고, 거절하면 저장하지 않는다', async () => {
    const write = savedWrite()
    const confirmOverwrite = vi.fn(async () => false)
    const dialogs = createFakeDialogs({ pickSavePath: async () => '/notes/회의록', confirmOverwrite }).dialogs
    const service = createFileService({ dialogs, platform: 'win32', write, exists: async () => true })
    expect(await service.save(saveRequest())).toEqual({ status: 'canceled' })
    expect(confirmOverwrite).toHaveBeenCalledWith('/notes/회의록.md')
    expect(write).not.toHaveBeenCalled()
  })

  it('확장자를 붙인 이름의 파일이 이미 있어도 덮어쓰기를 허락하면 저장한다', async () => {
    const write = savedWrite()
    const dialogs = createFakeDialogs({ pickSavePath: async () => '/notes/회의록', confirmOverwrite: async () => true })
      .dialogs
    const service = createFileService({ dialogs, platform: 'win32', write, exists: async () => true })
    expect(await service.save(saveRequest())).toMatchObject({ status: 'saved', path: '/notes/회의록.md' })
  })

  it('저장 창에서 고른 이름 그대로 저장하면 덮어쓰기를 다시 묻지 않는다', async () => {
    const confirmOverwrite = vi.fn(async () => false)
    const dialogs = createFakeDialogs({ pickSavePath: async () => '/notes/a.md', confirmOverwrite }).dialogs
    const service = createFileService({ dialogs, platform: 'win32', write: savedWrite(), exists: async () => true })
    expect(await service.save(saveRequest())).toMatchObject({ status: 'saved' })
    expect(confirmOverwrite).not.toHaveBeenCalled()
  })

  it('저장에 실패하면 이유를 보여 주고 실패를 알린다', async () => {
    const { dialogs, shownErrors } = createFakeDialogs()
    const write = async () => ({ status: 'failed' as const, message: '디스크 공간이 부족합니다.' })
    const result = await createFileService({ dialogs, platform: 'win32', write }).save(
      saveRequest({ path: '/notes/a.md' }),
    )
    expect(result).toEqual({ status: 'failed', message: '디스크 공간이 부족합니다.' })
    expect(shownErrors).toEqual(['저장하지 못했습니다: 디스크 공간이 부족합니다.'])
  })
})
