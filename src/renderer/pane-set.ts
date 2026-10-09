export type PaneChange = { kind: 'added'; index: number } | { kind: 'removed'; index: number } | { kind: 'focused' }

export type PaneSet<P> = {
  all(): readonly P[]
  focused(): P
  add(): P | null
  remove(pane: P): boolean
  focus(pane: P): void
  focusNext(): void
}

export type PaneSetOptions<P> = {
  maxPanes: number
  createPane(): P
  destroyPane(pane: P): void
  onChanged(change: PaneChange): void
}

export function createPaneSet<P>({ maxPanes, createPane, destroyPane, onChanged }: PaneSetOptions<P>): PaneSet<P> {
  const panes: P[] = [createPane()]
  let focusedIndex = 0

  return {
    all: () => panes,
    focused: () => panes[focusedIndex],
    add() {
      if (panes.length >= maxPanes) return null
      const pane = createPane()
      const index = focusedIndex + 1
      panes.splice(index, 0, pane)
      focusedIndex = index
      onChanged({ kind: 'added', index })
      return pane
    },
    remove(pane) {
      const index = panes.indexOf(pane)
      if (index === -1 || panes.length === 1) return false
      const focusedPane = panes[focusedIndex]
      panes.splice(index, 1)
      destroyPane(pane)
      focusedIndex = focusedPane === pane ? Math.max(0, index - 1) : panes.indexOf(focusedPane)
      onChanged({ kind: 'removed', index })
      return true
    },
    focus(pane) {
      const index = panes.indexOf(pane)
      if (index === -1 || index === focusedIndex) return
      focusedIndex = index
      onChanged({ kind: 'focused' })
    },
    focusNext() {
      if (panes.length === 1) return
      focusedIndex = (focusedIndex + 1) % panes.length
      onChanged({ kind: 'focused' })
    },
  }
}
