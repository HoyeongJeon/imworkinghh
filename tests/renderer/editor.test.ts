// @vitest-environment jsdom
import { undoDepth } from '@codemirror/commands'
import { language } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createEditor, type CursorPosition } from '../../src/renderer/editor'

function setup(initialText = '# 제목', display = { fontSize: 14, lineNumbersVisible: true }) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const changeNotices: unknown[][] = []
  const cursorPositions: CursorPosition[] = []
  let typedCount = 0
  const editor = createEditor({
    parent,
    initialText,
    syntaxHighlight: true,
    fontSize: display.fontSize,
    lineNumbersVisible: display.lineNumbersVisible,
    onTextChanged: (...args: unknown[]) => changeNotices.push(args),
    onCursorMoved: (position) => cursorPositions.push(position),
    onUserTyped: () => typedCount++,
  })
  const view = () => EditorView.findFromDOM(parent.querySelector('.cm-editor') as HTMLElement)!
  return { editor, parent, view, changeNotices, cursorPositions, typedCount: () => typedCount }
}

function pressKey(view: EditorView, key: KeyboardEventInit) {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...key }))
}

describe('글쓰기 에디터', () => {
  it('처음 받은 글을 보여 준다', () => {
    expect(setup('# 회의록').editor.getText()).toBe('# 회의록')
  })

  it('글을 통째로 바꾸면 바뀌었다고 알린다', () => {
    const { editor, changeNotices } = setup()
    editor.setText('새 글')
    expect(editor.getText()).toBe('새 글')
    expect(changeNotices).toHaveLength(1)
  })

  it('새 글로 바꾸면 되돌리기 기록이 비워진다', () => {
    const { editor, view } = setup()
    view().dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' })
    expect(undoDepth(view().state)).toBeGreaterThan(0)
    editor.setText('다른 파일')
    expect(undoDepth(view().state)).toBe(0)
  })

  it('사용자가 입력하면 입력했다고 알린다', () => {
    const { editor, view, typedCount } = setup('')
    view().dispatch({ changes: { from: 0, insert: '가' }, userEvent: 'input.type' })
    expect(typedCount()).toBe(1)
    expect(editor.getText()).toBe('가')
  })

  it('큰 글에서도 입력이 느려지지 않도록 바뀐 글 전체 대신 바뀌었다는 사실만 알린다', () => {
    const { view, changeNotices } = setup('')
    view().dispatch({ changes: { from: 0, insert: '가' }, userEvent: 'input.type' })
    expect(changeNotices).toEqual([[]])
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

  it('줄 번호 칸은 화면에 보이는 줄마다 번호를 붙이는 번호 칸을 쓴다', () => {
    const { editor, view } = setup()
    editor.setText('첫 줄\n둘째 줄')
    const visibleRows = view().dom.querySelectorAll(
      '.cm-visual-line-numbers .cm-gutterElement:not([style*="hidden"]) .cm-visual-row',
    )
    const numbers = [...visibleRows].map((row) => row.textContent)
    expect(numbers).toEqual(['1', '2'])
  })

  it('줄 번호를 숨기면 줄 번호 칸이 사라지고 다시 보이면 나타난다', () => {
    const { editor, view } = setup()
    editor.setLineNumbersVisible(false)
    expect(view().dom.querySelector('.cm-visual-line-numbers')).toBeNull()
    editor.setLineNumbersVisible(true)
    expect(view().dom.querySelector('.cm-visual-line-numbers')).not.toBeNull()
  })

  it('글을 바꿔도 줄 번호 숨김 설정은 유지된다', () => {
    const { editor, view } = setup()
    editor.setLineNumbersVisible(false)
    editor.setText('다른 글')
    expect(view().dom.querySelector('.cm-visual-line-numbers')).toBeNull()
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
    expect(getComputedStyle(view().dom).fontSize).toBe('20px')
  })

  it('처음 받은 글꼴 크기와 줄 번호 표시로 시작한다', () => {
    const { view } = setup('', { fontSize: 20, lineNumbersVisible: false })
    expect(getComputedStyle(view().dom).fontSize).toBe('20px')
    expect(view().dom.querySelector('.cm-visual-line-numbers')).toBeNull()
  })

  it('Ctrl+F를 누르면 찾기 창이 열린다', () => {
    const { view } = setup()
    pressKey(view(), { key: 'f', ctrlKey: true })
    expect(view().dom.querySelector('.cm-search')).not.toBeNull()
  })

  it('찾기 창에서 모두 바꾸면 사용자가 입력한 것으로 친다', () => {
    const { editor, view, typedCount } = setup('고양이와 고양이')
    pressKey(view(), { key: 'f', ctrlKey: true })
    const panel = view().dom.querySelector('.cm-search') as HTMLElement
    const field = (name: string) => panel.querySelector(`[name=${name}]`) as HTMLInputElement
    field('search').value = '고양이'
    field('replace').value = '강아지'
    field('replace').dispatchEvent(new Event('change'))
    field('replaceAll').click()
    expect(editor.getText()).toBe('강아지와 강아지')
    expect(typedCount()).toBe(1)
  })

  it('줄 이동 키를 누르면 아무 창도 열리지 않는다', () => {
    const { view } = setup()
    pressKey(view(), { key: 'g', ctrlKey: true, altKey: true })
    expect(view().dom.querySelector('.cm-panel')).toBeNull()
  })

  it('없애면 에디터가 화면에서 사라진다', () => {
    const { editor, parent } = setup()
    editor.destroy()
    expect(parent.querySelector('.cm-editor')).toBeNull()
  })
})
