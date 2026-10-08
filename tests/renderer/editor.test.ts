// @vitest-environment jsdom
import { undoDepth } from '@codemirror/commands'
import { language } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createEditor, type CursorPosition } from '../../src/renderer/editor'

function setup(initialText = '# 제목') {
  const parent = document.createElement('div')
  document.body.append(parent)
  const changedTexts: string[] = []
  const cursorPositions: CursorPosition[] = []
  let typedCount = 0
  const editor = createEditor({
    parent,
    initialText,
    syntaxHighlight: true,
    onTextChanged: (text) => changedTexts.push(text),
    onCursorMoved: (position) => cursorPositions.push(position),
    onUserTyped: () => typedCount++,
  })
  const view = () => EditorView.findFromDOM(parent.querySelector('.cm-editor') as HTMLElement)!
  return { editor, view, changedTexts, cursorPositions, typedCount: () => typedCount }
}

describe('글쓰기 에디터', () => {
  it('처음 받은 글을 보여 준다', () => {
    expect(setup('# 회의록').editor.getText()).toBe('# 회의록')
  })

  it('글을 통째로 바꾸면 바뀐 글을 알린다', () => {
    const { editor, changedTexts } = setup()
    editor.setText('새 글')
    expect(editor.getText()).toBe('새 글')
    expect(changedTexts.at(-1)).toBe('새 글')
  })

  it('새 글로 바꾸면 되돌리기 기록이 비워진다', () => {
    const { editor, view } = setup()
    view().dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' })
    expect(undoDepth(view().state)).toBeGreaterThan(0)
    editor.setText('다른 파일')
    expect(undoDepth(view().state)).toBe(0)
  })

  it('사용자가 입력하면 입력했다고 알린다', () => {
    const { view, typedCount, changedTexts } = setup('')
    view().dispatch({ changes: { from: 0, insert: '가' }, userEvent: 'input.type' })
    expect(typedCount()).toBe(1)
    expect(changedTexts.at(-1)).toBe('가')
  })

  it('프로그램이 글을 바꾼 것은 입력으로 치지 않는다', () => {
    const { editor, typedCount } = setup()
    editor.setText('불러온 글')
    expect(typedCount()).toBe(0)
  })

  it('커서를 옮기면 줄과 칸 위치를 알린다', () => {
    const { editor, view, cursorPositions } = setup()
    editor.setText('ab\ncd')
    view().dispatch({ selection: { anchor: 4 } })
    expect(cursorPositions.at(-1)).toEqual({ line: 2, column: 2 })
  })

  it('문법 색칠을 끄면 마크다운으로 해석하지 않고 다시 켜면 해석한다', () => {
    const { editor, view } = setup()
    expect(view().state.facet(language)).not.toBeNull()
    editor.setSyntaxHighlight(false)
    expect(view().state.facet(language)).toBeNull()
    editor.setSyntaxHighlight(true)
    expect(view().state.facet(language)).not.toBeNull()
  })

  it('글을 바꿔도 문법 색칠 설정은 유지된다', () => {
    const { editor, view } = setup()
    editor.setSyntaxHighlight(false)
    editor.setText('# 다른 글')
    expect(view().state.facet(language)).toBeNull()
  })

  it('글꼴 크기를 바꾸면 줄 번호와 글이 같은 크기로 바뀐다', () => {
    const { editor, view } = setup()
    editor.setFontSize(20)
    expect(view().dom.style.fontSize).toBe('20px')
  })
})
