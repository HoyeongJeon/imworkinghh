import { describe, expect, it, vi } from 'vitest'
import { createCommandLock, type CommandLock } from '../../src/renderer/command-lock'
import {
  createDocumentCommands,
  type CommandsApi,
  type FileLocation,
} from '../../src/renderer/document-commands'
import { createDocumentState } from '../../src/renderer/document-state'
import type { OpenedFile } from '../../src/shared/api'

const openedFile: OpenedFile = {
  path: '/notes/a.md',
  directory: '/notes',
  text: '# 열린 글',
  eol: 'lf',
  encoding: 'utf-8',
  format: 'md',
}

const openedResult = { status: 'opened' as const, file: openedFile }

function createFakeApi(overrides: Partial<CommandsApi> = {}) {
  const calls: string[] = []
  const api: CommandsApi = {
    openFileDialog: async () => {
      calls.push('openFileDialog')
      return openedResult
    },
    openPath: async (path) => {
      calls.push(`openPath ${path}`)
      return { status: 'failed', message: '없음' }
    },
    saveFile: async (request) => {
      calls.push(`saveFile path=${request.path} saveAs=${request.saveAs}`)
      return { status: 'saved', path: request.path ?? '/notes/new.md', directory: '/notes', format: 'md' }
    },
    confirmDiscard: async () => {
      calls.push('confirmDiscard')
      return 'cancel'
    },
    ...overrides,
  }
  return { api, calls }
}

function setup(api: CommandsApi, { lock = createCommandLock(), openElsewhere = [] as string[] }: { lock?: CommandLock; openElsewhere?: string[] } = {}) {
  let text = ''
  let backupStaleCount = 0
  const focusedElsewhere: string[] = []
  const editor = { getText: () => text, setText: (next: string) => (text = next) }
  const documentState = createDocumentState('lf')
  const locations: (FileLocation | null)[] = []
  const commands = createDocumentCommands({
    api,
    lock,
    editor,
    documentState,
    savePreferences: () => ({ defaultDirectory: '/notes', defaultFormat: 'md' }),
    focusIfOpenElsewhere: (path) => {
      if (!openElsewhere.includes(path)) return false
      focusedElsewhere.push(path)
      return true
    },
    onFileLocationChanged: (location) => locations.push(location),
    onDocumentReplaced: () => undefined,
    onBackupStale: () => backupStaleCount++,
  })
  return {
    commands,
    documentState,
    locations,
    focusedElsewhere,
    backupStaleCount: () => backupStaleCount,
    type: (next: string) => (text = next),
    text: () => text,
  }
}

describe('새 문서', () => {
  it('변경이 없으면 묻지 않고 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    expect(await commands.newDocument()).toBe(true)
    expect(calls).not.toContain('confirmDiscard')
  })

  it('저장 안 한 변경이 있으면 새 문서 전에 저장할지 묻는다', async () => {
    const { api, calls } = createFakeApi()
    const { commands, type } = setup(api)
    type('쓰던 글')
    await commands.newDocument()
    expect(calls[0]).toBe('confirmDiscard')
  })

  it('저장을 고르면 저장한 뒤 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'save' })
    const { commands, type, text } = setup(api)
    type('쓰던 글')
    expect(await commands.newDocument()).toBe(true)
    expect(calls).toContain('saveFile path=null saveAs=false')
    expect(text()).toBe('')
  })

  it('저장 안 함을 고르면 저장하지 않고 새 문서를 연다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'discard' })
    const { commands, type, text } = setup(api)
    type('버릴 글')
    expect(await commands.newDocument()).toBe(true)
    expect(calls.some((call) => call.startsWith('saveFile'))).toBe(false)
    expect(text()).toBe('')
  })

  it('취소를 고르면 아무것도 바꾸지 않는다', async () => {
    const { api } = createFakeApi()
    const { commands, type, text } = setup(api)
    type('지키는 글')
    expect(await commands.newDocument()).toBe(false)
    expect(text()).toBe('지키는 글')
  })

  it('저장 창을 취소하면 새 문서를 열지 않는다', async () => {
    const { api } = createFakeApi({ confirmDiscard: async () => 'save', saveFile: async () => ({ status: 'canceled' }) })
    const { commands, type, text } = setup(api)
    type('지키는 글')
    expect(await commands.newDocument()).toBe(false)
    expect(text()).toBe('지키는 글')
  })

  it('새 문서를 열면 열린 파일이 없다고 알리고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, locations, backupStaleCount } = setup(api)
    await commands.newDocument()
    expect(locations.at(-1)).toBeNull()
    expect(backupStaleCount()).toBe(1)
  })
})

describe('저장', () => {
  it('저장하면 고른 경로와 형식을 알리고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, type, locations, backupStaleCount } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(true)
    expect(locations.at(-1)).toEqual({ path: '/notes/new.md', directory: '/notes', format: 'md', origin: 'saved' })
    expect(backupStaleCount()).toBe(1)
  })

  it('저장하고 나면 변경 없음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, type, documentState } = setup(api)
    type('새 글')
    await commands.save()
    expect(documentState.isDirty('새 글')).toBe(false)
  })

  it('저장에 실패하면 변경 상태를 그대로 두고 백업도 그대로 둔다', async () => {
    const { api } = createFakeApi({ saveFile: async () => ({ status: 'failed', message: '권한' }) })
    const { commands, type, documentState, backupStaleCount } = setup(api)
    type('새 글')
    expect(await commands.save()).toBe(false)
    expect(documentState.isDirty('새 글')).toBe(true)
    expect(backupStaleCount()).toBe(0)
  })

  it('경로가 있는 문서를 저장하면 그 경로로 저장을 요청한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands, type } = setup(api)
    await commands.open()
    type('# 고친 글')
    await commands.save()
    expect(calls).toContain('saveFile path=/notes/a.md saveAs=false')
  })

  it('다른 이름으로 저장은 저장 창을 띄우도록 요청한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    await commands.open()
    await commands.saveAs()
    expect(calls).toContain('saveFile path=/notes/a.md saveAs=true')
  })
})

describe('열기', () => {
  it('파일을 열면 에디터에 내용을 넣고 변경 없음 상태가 되며 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState, locations, backupStaleCount } = setup(api)
    expect(await commands.open()).toBe(true)
    expect(text()).toBe('# 열린 글')
    expect(documentState.isDirty('# 열린 글')).toBe(false)
    expect(locations.at(-1)).toMatchObject({ path: '/notes/a.md', origin: 'opened' })
    expect(backupStaleCount()).toBe(1)
  })

  it('마지막 파일 다시 열기에 실패하면 새 문서 그대로 둔다', async () => {
    const { api } = createFakeApi()
    const { commands, text } = setup(api)
    expect(await commands.openPath('/notes/gone.md')).toBe(false)
    expect(text()).toBe('')
  })
})

describe('복구', () => {
  it('저장 안 한 내용이 있는 칸을 복구하면 내용을 넣고 변경 있음 상태가 된다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState } = setup(api)
    expect(await commands.restore({ path: '/notes/a.md', eol: 'lf', unsavedContent: '복구한 글' })).toBe(true)
    expect(text()).toBe('복구한 글')
    expect(documentState.isDirty('복구한 글')).toBe(true)
    expect(documentState.info().path).toBe('/notes/a.md')
  })

  it('변경 없던 칸을 복구하면 그 파일을 다시 연다', async () => {
    const { api, calls } = createFakeApi({
      openPath: async (path) => {
        calls.push(`openPath ${path}`)
        return openedResult
      },
    })
    const { commands, text } = setup(api)
    expect(await commands.restore({ path: '/notes/a.md', eol: 'lf', unsavedContent: null })).toBe(true)
    expect(calls).toContain('openPath /notes/a.md')
    expect(text()).toBe('# 열린 글')
  })

  it('변경 없던 칸의 파일이 없어졌으면 빈 새 문서로 둔다', async () => {
    const { api } = createFakeApi()
    const { commands, text, documentState } = setup(api)
    expect(await commands.restore({ path: '/notes/gone.md', eol: 'lf', unsavedContent: null })).toBe(false)
    expect(text()).toBe('')
    expect(documentState.info().path).toBeNull()
  })
})

describe('닫기 확인', () => {
  it('변경이 없으면 묻지 않고 닫아도 된다고 답한다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api)
    expect(await commands.confirmClose()).toBe(true)
    expect(calls).toEqual([])
  })

  it('저장 안 함을 고르면 저장하지 않고 닫아도 된다고 답한다', async () => {
    const { api, calls } = createFakeApi({ confirmDiscard: async () => 'discard' })
    const { commands, type } = setup(api)
    type('버릴 글')
    expect(await commands.confirmClose()).toBe(true)
    expect(calls.some((call) => call.startsWith('saveFile'))).toBe(false)
  })

  it('저장을 골랐는데 저장 창을 취소하면 닫으면 안 된다고 답한다', async () => {
    const { api } = createFakeApi({ confirmDiscard: async () => 'save', saveFile: async () => ({ status: 'canceled' }) })
    const { commands, type } = setup(api)
    type('잃으면 안 되는 글')
    expect(await commands.confirmClose()).toBe(false)
  })
})

describe('다른 프로그램에서 열기', () => {
  it('저장 안 한 변경이 있으면 열기 전에 저장할지 묻는다', async () => {
    const { api, calls } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type } = setup(api)
    type('쓰던 글')
    await commands.openRequestedFile('/notes/a.md')
    expect(calls[0]).toBe('confirmDiscard')
  })

  it('취소하면 지금 문서를 그대로 둔다', async () => {
    const { api } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type, text } = setup(api)
    type('쓰던 글')
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(false)
    expect(text()).toBe('쓰던 글')
  })

  it('열지 못하면 이유를 보여 주도록 요청하고 지금 문서를 그대로 둔다', async () => {
    const requests: string[] = []
    const { api } = createFakeApi({
      openPath: async (path, options) => {
        requests.push(`${path} reportErrors=${options?.reportErrors}`)
        return { status: 'failed', message: '없음' }
      },
    })
    const { commands, text } = setup(api)
    expect(await commands.openRequestedFile('/notes/gone.md')).toBe(false)
    expect(requests).toEqual(['/notes/gone.md reportErrors=true'])
    expect(text()).toBe('')
  })

  it('열면 에디터에 내용을 넣고 백업을 고쳐 쓰라고 알린다', async () => {
    const { api } = createFakeApi({ openPath: async () => openedResult })
    const { commands, text, locations, backupStaleCount } = setup(api)
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(true)
    expect(text()).toBe('# 열린 글')
    expect(backupStaleCount()).toBe(1)
    expect(locations.at(-1)).toMatchObject({ path: '/notes/a.md', origin: 'opened' })
  })
})

describe('다른 칸에 열린 파일', () => {
  it('다른 칸에 열린 파일을 열라는 요청이 오면 묻지도 열지도 않고 그 칸으로 옮긴다', async () => {
    const { api, calls } = createFakeApi({ openPath: async () => openedResult })
    const { commands, type, text, focusedElsewhere } = setup(api, { openElsewhere: ['/notes/a.md'] })
    type('쓰던 글')
    expect(await commands.openRequestedFile('/notes/a.md')).toBe(false)
    expect(calls).not.toContain('confirmDiscard')
    expect(focusedElsewhere).toEqual(['/notes/a.md'])
    expect(text()).toBe('쓰던 글')
  })

  it('열기 창에서 다른 칸에 열린 파일을 고르면 열지 않고 그 칸으로 옮긴다', async () => {
    const { api } = createFakeApi()
    const { commands, text, focusedElsewhere } = setup(api, { openElsewhere: ['/notes/a.md'] })
    expect(await commands.open()).toBe(false)
    expect(focusedElsewhere).toEqual(['/notes/a.md'])
    expect(text()).toBe('')
  })

  it('다시 열 파일이 다른 칸에 열려 있으면 열지 않는다', async () => {
    const { api, calls } = createFakeApi()
    const { commands } = setup(api, { openElsewhere: ['/notes/a.md'] })
    expect(await commands.openPath('/notes/a.md')).toBe(false)
    expect(calls).not.toContain('openPath /notes/a.md')
  })
})

describe('명령 겹침', () => {
  function pendingSave() {
    let finish: () => void = () => undefined
    const saveFile: CommandsApi['saveFile'] = (request) =>
      new Promise((resolve) => {
        finish = () => resolve({ status: 'saved', path: request.path ?? '/notes/new.md', directory: '/notes', format: 'md' })
      })
    return { saveFile, finish: () => finish() }
  }

  it('저장 창이 떠 있는 동안 다시 누른 저장은 무시한다', async () => {
    const pending = pendingSave()
    const saveFile = vi.fn(pending.saveFile)
    const { api } = createFakeApi({ saveFile })
    const { commands } = setup(api)
    const first = commands.save()
    expect(await commands.save()).toBe(false)
    pending.finish()
    expect(await first).toBe(true)
    expect(saveFile).toHaveBeenCalledTimes(1)
  })

  it('같은 잠금을 쓰는 다른 칸의 명령도 저장 창이 떠 있는 동안 무시한다', async () => {
    const pending = pendingSave()
    const lock = createCommandLock()
    const left = setup(createFakeApi({ saveFile: pending.saveFile }).api, { lock })
    const rightApi = createFakeApi()
    const right = setup(rightApi.api, { lock })
    const saving = left.commands.save()
    expect(await right.commands.open()).toBe(false)
    expect(rightApi.calls).not.toContain('openFileDialog')
    pending.finish()
    expect(await saving).toBe(true)
  })

  it('다른 프로그램에서 연 파일은 진행 중인 명령이 끝난 뒤에 연다', async () => {
    const pending = pendingSave()
    const { api, calls } = createFakeApi({
      saveFile: pending.saveFile,
      openPath: async (path) => {
        calls.push(`openPath ${path}`)
        return openedResult
      },
    })
    const { commands, text } = setup(api)
    const saving = commands.save()
    const opening = commands.openRequestedFile('/notes/a.md')
    await Promise.resolve()
    expect(calls).not.toContain('openPath /notes/a.md')
    pending.finish()
    await saving
    expect(await opening).toBe(true)
    expect(text()).toBe('# 열린 글')
  })
})
