// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommandLock } from '../../src/renderer/command-lock'
import { createDebouncedTask } from '../../src/renderer/debounce'
import { createDocumentCommands, type CommandsApi } from '../../src/renderer/document-commands'
import { DOCUMENT_STATUS_DELAY_MS, createDocumentPane } from '../../src/renderer/document-pane'
import { createDocumentState } from '../../src/renderer/document-state'
import { createEditor } from '../../src/renderer/editor'
import type { OpenedFile } from '../../src/shared/api'

afterEach(() => {
  vi.useRealTimers()
})

const openedFile: OpenedFile = {
  path: '/notes/a.md',
  directory: '/notes',
  text: '# 열린 글',
  eol: 'lf',
  encoding: 'utf-8',
  format: 'md',
}

function setup({ openElsewhere = false, lineNumbersVisible = false } = {}) {
  const events: string[] = []
  const api: CommandsApi = {
    openFileDialog: async () => ({ status: 'canceled' }),
    openPath: async () => ({ status: 'opened', file: openedFile }),
    saveFile: async () => ({ status: 'canceled' }),
    confirmDiscard: async () => 'cancel',
  }
  const pane = createDocumentPane({
    doc: document,
    parts: { createEditor, createDocumentState, createDocumentCommands, createDebouncedTask },
    defaultEol: 'lf',
    display: { syntaxHighlight: false, fontSize: 14, lineNumbersVisible },
    api,
    lock: createCommandLock(),
    savePreferences: () => ({ defaultDirectory: null, defaultFormat: 'md' }),
    focusIfOpenElsewhere: () => openElsewhere,
    onFileLocationChanged: (location) => events.push(`location ${location?.path ?? null}`),
    onBackupStale: () => events.push('backupStale'),
    onStatusChanged: () => events.push('status'),
    onUserTyped: () => events.push('typed'),
    onFocused: () => events.push('focused'),
  })
  document.body.append(pane.element)
  const view = () => EditorView.findFromDOM(pane.element.querySelector('.cm-editor') as HTMLElement)!
  return { pane, events, view }
}

describe('글 칸', () => {
  it('새 칸은 빈 새 문서이고 만드는 동안 아무것도 알리지 않는다', () => {
    const { pane, events } = setup()
    expect(pane.element.classList.contains('editor-pane')).toBe(true)
    expect(pane.filePath()).toBeNull()
    expect(pane.isDirty()).toBe(false)
    expect(pane.status()).toMatchObject({ fileName: null, dirty: false, characters: 0, encoding: 'utf-8' })
    expect(events).toEqual([])
  })

  it('파일을 열면 칸의 파일 경로와 상태가 그 파일을 따른다', async () => {
    const { pane, events } = setup()
    expect(await pane.commands.openPath('/notes/a.md')).toBe(true)
    expect(pane.filePath()).toBe('/notes/a.md')
    expect(pane.status()).toMatchObject({ fileName: 'a.md', dirty: false, characters: 6 })
    expect(events).toContain('location /notes/a.md')
  })

  it('다른 칸에 열린 파일이면 이 칸에 열지 않는다', async () => {
    const { pane } = setup({ openElsewhere: true })
    expect(await pane.commands.openPath('/notes/a.md')).toBe(false)
    expect(pane.filePath()).toBeNull()
  })

  it('글을 고치면 바로 변경 있음으로 답하고, 상태바 정보는 입력이 잠깐 멈춘 뒤에 바뀐다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { pane, view, events } = setup()
    view().dispatch({ changes: { from: 0, insert: '가나' }, userEvent: 'input.type' })
    expect(pane.isDirty()).toBe(true)
    expect(pane.status().dirty).toBe(false)
    expect(events).toContain('typed')
    vi.advanceTimersByTime(DOCUMENT_STATUS_DELAY_MS)
    expect(pane.status()).toMatchObject({ dirty: true, characters: 2 })
    expect(events.at(-1)).toBe('status')
  })

  it('스냅샷은 칸의 경로, 줄바꿈, 저장 안 한 내용을 담는다', () => {
    const { pane, view } = setup()
    view().dispatch({ changes: { from: 0, insert: '새 글' } })
    expect(pane.snapshot()).toEqual({ path: null, eol: 'lf', unsavedContent: '새 글' })
  })

  it('칸 안으로 커서가 들어오면 지금 칸이 되었다고 알린다', () => {
    const { pane, events } = setup()
    pane.element.querySelector('.cm-content')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(events).toContain('focused')
  })

  it('보기 설정을 처음부터 받고, 바꾸면 칸의 에디터에 적용한다', () => {
    const { pane } = setup({ lineNumbersVisible: false })
    expect(pane.element.querySelector('.cm-visual-line-numbers')).toBeNull()
    pane.setLineNumbersVisible(true)
    expect(pane.element.querySelector('.cm-visual-line-numbers')).not.toBeNull()
  })

  it('칸을 없애면 화면에서 사라진다', () => {
    const { pane } = setup()
    pane.destroy()
    expect(pane.element.isConnected).toBe(false)
    expect(pane.element.querySelector('.cm-editor')).toBeNull()
  })
})
