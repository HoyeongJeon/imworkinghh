import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, GutterMarker, drawSelection, gutter, highlightActiveLine, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { firstVisualRow, rowsBetween, visualRowNumbers } from './visual-lines'

export type CursorPosition = { line: number; column: number }

export type Editor = {
  getText(): string
  setText(text: string): void
  setSyntaxHighlight(enabled: boolean): void
  setLineNumbersVisible(visible: boolean): void
  setFontSize(px: number): void
  focus(): void
  destroy(): void
}

export type EditorOptions = {
  parent: HTMLElement
  initialText: string
  syntaxHighlight: boolean
  fontSize: number
  lineNumbersVisible: boolean
  onTextChanged(): void
  onCursorMoved(position: CursorPosition): void
  onUserTyped(): void
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-md-heading)', fontWeight: 'bold' },
  { tag: tags.strong, color: 'var(--color-md-strong)', fontWeight: 'bold' },
  { tag: tags.emphasis, color: 'var(--color-md-emphasis)', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--color-md-code)' },
  { tag: [tags.link, tags.url], color: 'var(--color-md-link)' },
  { tag: tags.quote, color: 'var(--color-md-quote)' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: 'var(--color-md-meta)' },
  { tag: [tags.keyword, tags.operatorKeyword], color: 'var(--color-md-link)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-md-code)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-md-emphasis)' },
  { tag: tags.comment, color: 'var(--color-md-quote)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.typeName, tags.className], color: 'var(--color-md-strong)' },
])

function highlightExtensions(enabled: boolean): Extension {
  if (!enabled) return []
  return [markdown({ base: markdownLanguage, codeLanguages: languages }), syntaxHighlighting(markdownHighlightStyle)]
}

function fontSizeTheme(px: number): Extension {
  return EditorView.theme({ '&': { fontSize: `${px}px` } })
}

class VisualRowNumbersMarker extends GutterMarker {
  constructor(readonly numbers: number[]) {
    super()
  }

  eq(other: VisualRowNumbersMarker): boolean {
    return other.numbers.length === this.numbers.length && other.numbers[0] === this.numbers[0]
  }

  toDOM(view: EditorView): Node {
    const doc = view.dom.ownerDocument
    const wrapper = doc.createElement('div')
    for (const number of this.numbers) {
      const row = doc.createElement('div')
      row.className = 'cm-visual-row'
      row.textContent = String(number)
      wrapper.append(row)
    }
    return wrapper
  }
}

function lastVisualRowMarker(view: EditorView): VisualRowNumbersMarker {
  const lastBlock = view.lineBlockAt(view.state.doc.length)
  const rows = visualRowNumbers(lastBlock.top, lastBlock.height, view.defaultLineHeight)
  return new VisualRowNumbersMarker([rows[rows.length - 1]])
}

const visualLineNumbers = gutter({
  class: 'cm-lineNumbers cm-visual-line-numbers',
  lineMarker: (view, line) => new VisualRowNumbersMarker(visualRowNumbers(line.top, line.height, view.defaultLineHeight)),
  lineMarkerChange: (update) => update.docChanged || update.geometryChanged || update.viewportChanged,
  initialSpacer: lastVisualRowMarker,
  updateSpacer: (spacer, update) => {
    const next = lastVisualRowMarker(update.view)
    return next.eq(spacer as VisualRowNumbersMarker) ? spacer : next
  },
})

function cursorPosition(view: EditorView): CursorPosition {
  const range = view.state.selection.main
  const block = view.lineBlockAt(range.head)
  const rowStart = view.moveToLineBoundary(range, false, true).head
  const lineHeight = view.defaultLineHeight
  const blockStartCoords = view.coordsAtPos(block.from, 1)
  const rowStartCoords = view.coordsAtPos(rowStart, 1)
  const rowsIntoBlock =
    blockStartCoords && rowStartCoords ? rowsBetween(blockStartCoords.top, rowStartCoords.top, lineHeight) : 0
  return { line: firstVisualRow(block.top, lineHeight) + rowsIntoBlock, column: range.head - rowStart + 1 }
}

export function createEditor(options: EditorOptions): Editor {
  const highlightCompartment = new Compartment()
  const fontSizeCompartment = new Compartment()
  const lineNumbersCompartment = new Compartment()
  let lineNumbersVisible = options.lineNumbersVisible
  let syntaxHighlightEnabled = options.syntaxHighlight
  let fontSizePx = options.fontSize

  const notifyChanges = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.onTextChanged()
      const typedByUser = update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
      if (typedByUser) options.onUserTyped()
    }
    // 창 너비나 글꼴 크기가 바뀌면 커서가 그대로여도 화면 줄 위치가 바뀐다.
    if (update.docChanged || update.selectionSet || update.geometryChanged) {
      options.onCursorMoved(cursorPosition(update.view))
    }
  })

  const createState = (text: string) =>
    EditorState.create({
      doc: text,
      extensions: [
        lineNumbersCompartment.of(lineNumbersVisible ? visualLineNumbers : []),
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        highlightCompartment.of(highlightExtensions(syntaxHighlightEnabled)),
        fontSizeCompartment.of(fontSizeTheme(fontSizePx)),
        notifyChanges,
      ],
    })

  const view = new EditorView({ parent: options.parent, state: createState(options.initialText) })

  return {
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.setState(createState(text))
      options.onTextChanged()
      options.onCursorMoved(cursorPosition(view))
    },
    setSyntaxHighlight(enabled) {
      syntaxHighlightEnabled = enabled
      view.dispatch({ effects: highlightCompartment.reconfigure(highlightExtensions(enabled)) })
    },
    setLineNumbersVisible(visible) {
      lineNumbersVisible = visible
      view.dispatch({ effects: lineNumbersCompartment.reconfigure(visible ? visualLineNumbers : []) })
    },
    setFontSize(px) {
      fontSizePx = px
      // CSS로만 바꾸면 CodeMirror가 줄 높이를 다시 재지 않아 줄 번호와 글이 어긋난다. 테마로 바꿔야 다시 잰다.
      view.dispatch({ effects: fontSizeCompartment.reconfigure(fontSizeTheme(px)) })
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
