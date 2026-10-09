import { widthsAfterDrag } from './pane-widths'

export const PANE_DIVIDER_PX = 6

export type PaneLayout = {
  render(paneElements: readonly HTMLElement[], widths: readonly number[]): void
  hostWidth(): number
}

export type PaneLayoutOptions = {
  host: HTMLElement
  minPanePx: number
  onWidthsCommitted(widths: number[]): void
}

export function createPaneLayout({ host, minPanePx, onWidthsCommitted }: PaneLayoutOptions): PaneLayout {
  const doc = host.ownerDocument
  const dividers: HTMLElement[] = []
  let widths: number[] = []

  function applyWidths(): void {
    host.style.gridTemplateColumns = widths.map((width) => `minmax(0, ${width}fr)`).join(` ${PANE_DIVIDER_PX}px `)
  }

  function paneAreaWidth(): number {
    return host.getBoundingClientRect().width - PANE_DIVIDER_PX * (widths.length - 1)
  }

  function createDivider(index: number): HTMLElement {
    const divider = doc.createElement('div')
    divider.className = 'pane-divider'
    divider.setAttribute('role', 'separator')
    divider.setAttribute('aria-orientation', 'vertical')
    divider.addEventListener('pointerdown', (downEvent) => {
      downEvent.preventDefault()
      divider.setPointerCapture?.(downEvent.pointerId)
      const onMove = (moveEvent: PointerEvent) => {
        const available = paneAreaWidth()
        if (available <= 0) return
        // 칸 너비 비율은 막대를 뺀 너비 기준이므로, 이 막대 앞에 있는 막대들과 막대 자신의 절반을 뺀다.
        const pointerPx =
          moveEvent.clientX - host.getBoundingClientRect().left - PANE_DIVIDER_PX * index - PANE_DIVIDER_PX / 2
        widths = widthsAfterDrag(widths, index, pointerPx / available, minPanePx / available)
        applyWidths()
      }
      const onUp = () => {
        divider.removeEventListener('pointermove', onMove)
        divider.removeEventListener('pointerup', onUp)
        onWidthsCommitted([...widths])
      }
      divider.addEventListener('pointermove', onMove)
      divider.addEventListener('pointerup', onUp)
    })
    return divider
  }

  return {
    render(paneElements, nextWidths) {
      widths = [...nextWidths]
      while (dividers.length < paneElements.length - 1) dividers.push(createDivider(dividers.length))
      const ordered = paneElements.flatMap((element, index) => (index === 0 ? [element] : [dividers[index - 1], element]))
      // 에디터를 떼었다 붙이면 커서와 스크롤 위치를 잃으므로, 빠진 요소만 지우고 새 요소만 끼워 넣는다.
      for (const child of [...host.children]) {
        if (!ordered.includes(child as HTMLElement)) child.remove()
      }
      ordered.forEach((element, index) => {
        if (host.children[index] !== element) host.insertBefore(element, host.children[index] ?? null)
      })
      applyWidths()
    },
    hostWidth: () => host.getBoundingClientRect().width,
  }
}
