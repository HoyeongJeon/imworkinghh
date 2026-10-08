import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export type CursorPosition = { line: number; column: number }

export type Editor = {
  getText(): string
  setText(text: string): void
  setSyntaxHighlight(enabled: boolean): void
  focus(): void
}

export type EditorOptions = {
  parent: HTMLElement
  initialText: string
  syntaxHighlight: boolean
  onTextChanged(text: string): void
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

function cursorPosition(state: EditorState): CursorPosition {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  return { line: line.number, column: head - line.from + 1 }
}

export function createEditor(options: EditorOptions): Editor {
  const highlightCompartment = new Compartment()
  let syntaxHighlightEnabled = options.syntaxHighlight

  const notifyChanges = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.onTextChanged(update.state.doc.toString())
      const typedByUser = update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
      if (typedByUser) options.onUserTyped()
    }
    if (update.docChanged || update.selectionSet) options.onCursorMoved(cursorPosition(update.state))
  })

  const createState = (text: string) =>
    EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        highlightCompartment.of(highlightExtensions(syntaxHighlightEnabled)),
        notifyChanges,
      ],
    })

  const view = new EditorView({ parent: options.parent, state: createState(options.initialText) })

  return {
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.setState(createState(text))
      options.onTextChanged(text)
      options.onCursorMoved(cursorPosition(view.state))
    },
    setSyntaxHighlight(enabled) {
      syntaxHighlightEnabled = enabled
      view.dispatch({ effects: highlightCompartment.reconfigure(highlightExtensions(enabled)) })
    },
    focus: () => view.focus(),
  }
}
