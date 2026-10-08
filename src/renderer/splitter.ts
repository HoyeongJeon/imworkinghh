import { ratioFromPointer } from './split-layout'

export const SPLIT_HANDLE_PX = 6

export type Splitter = {
  setRatio(ratio: number): void
  getRatio(): number
}

export type SplitterOptions = {
  container: HTMLElement
  handle: HTMLElement
  initialRatio: number
  onRatioCommitted(ratio: number): void
}

export function createSplitter({ container, handle, initialRatio, onRatioCommitted }: SplitterOptions): Splitter {
  let ratio = initialRatio

  function setRatio(next: number): void {
    ratio = next
    container.style.setProperty('--split-ratio', String(next))
  }

  function ratioAt(clientY: number): number {
    const rect = container.getBoundingClientRect()
    return ratioFromPointer(clientY - rect.top, rect.height - SPLIT_HANDLE_PX)
  }

  handle.addEventListener('pointerdown', (downEvent) => {
    downEvent.preventDefault()
    handle.setPointerCapture?.(downEvent.pointerId)
    const onMove = (moveEvent: PointerEvent) => setRatio(ratioAt(moveEvent.clientY))
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      onRatioCommitted(ratio)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  })

  setRatio(initialRatio)
  return { setRatio, getRatio: () => ratio }
}
