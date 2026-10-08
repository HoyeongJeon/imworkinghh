import { describe, expect, it } from 'vitest'
import { createDocumentState } from '../../src/renderer/document-state'
import type { OpenedFile } from '../../src/shared/api'

const openedFile: OpenedFile = {
  path: 'C:\\notes\\회의록.md',
  directory: 'C:\\notes',
  text: '# 회의록',
  eol: 'crlf',
  encoding: 'cp949',
  format: 'md',
}

describe('문서 변경 여부', () => {
  it('새 문서에 아무것도 안 썼으면 변경이 없다', () => {
    expect(createDocumentState('lf').isDirty('')).toBe(false)
  })

  it('불러온 내용과 다르면 변경이 있다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.isDirty('# 회의록 수정')).toBe(true)
  })

  it('고쳤다가 원래대로 되돌리면 변경이 없다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.isDirty('# 회의록')).toBe(false)
  })

  it('저장하면 그 내용이 새 기준이 되고 인코딩은 UTF-8이 된다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    state.markSaved({ path: 'C:\\notes\\회의록.md', format: 'md' }, '# 저장한 글')
    expect(state.isDirty('# 저장한 글')).toBe(false)
    expect(state.info().encoding).toBe('utf-8')
  })

  it('백업에서 복구한 문서는 저장하기 전까지 변경이 있다', () => {
    const state = createDocumentState('lf')
    state.loadUnsaved({ path: null, content: '복구한 글', eol: 'lf', savedAt: '2026-10-08T00:00:00.000Z' })
    expect(state.isDirty('복구한 글')).toBe(true)
  })

  it('새 문서를 시작하면 경로와 줄바꿈이 기본값으로 돌아간다', () => {
    const state = createDocumentState('crlf')
    state.loadFromFile({ ...openedFile, eol: 'lf' })
    state.startNew()
    expect(state.info()).toEqual({ path: null, eol: 'crlf', encoding: 'utf-8', format: null })
  })
})

describe('문서 이름', () => {
  it('파일 이름은 윈도우 경로와 맥 경로 모두 마지막 부분이다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.fileName()).toBe('회의록.md')
    state.loadFromFile({ ...openedFile, path: '/Users/me/notes/todo.txt' })
    expect(state.fileName()).toBe('todo.txt')
  })

  it('새 문서는 파일 이름이 없다', () => {
    expect(createDocumentState('lf').fileName()).toBeNull()
  })
})

describe('백업 스냅샷', () => {
  it('변경이 없으면 백업할 내용이 없다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.toBackup('# 회의록', '2026-10-08T00:00:00.000Z')).toBeNull()
  })

  it('새 문서에 아무것도 안 썼으면 백업하지 않는다', () => {
    expect(createDocumentState('lf').toBackup('', '2026-10-08T00:00:00.000Z')).toBeNull()
  })

  it('변경이 있으면 경로, 내용, 줄바꿈, 시각을 백업한다', () => {
    const state = createDocumentState('lf')
    state.loadFromFile(openedFile)
    expect(state.toBackup('# 고친 글', '2026-10-08T00:00:00.000Z')).toEqual({
      path: 'C:\\notes\\회의록.md',
      content: '# 고친 글',
      eol: 'crlf',
      savedAt: '2026-10-08T00:00:00.000Z',
    })
  })
})
