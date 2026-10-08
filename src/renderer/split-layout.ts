export const MIN_PANE_PX = 80
export const PANIC_RATIO = 1

export function clampTopPaneHeight(desiredTopPx: number, availablePx: number, minPanePx = MIN_PANE_PX): number {
  if (availablePx < minPanePx * 2) return availablePx / 2
  return Math.min(availablePx - minPanePx, Math.max(minPanePx, desiredTopPx))
}

export function ratioFromPointer(pointerOffsetPx: number, availablePx: number, minPanePx = MIN_PANE_PX): number {
  if (availablePx <= 0) return 0.5
  return clampTopPaneHeight(pointerOffsetPx, availablePx, minPanePx) / availablePx
}

export type PanicToggle = {
  toggle(currentRatio: number): number
  isPanicked(): boolean
}

export function createPanicToggle(): PanicToggle {
  let ratioBeforePanic: number | null = null
  return {
    toggle(currentRatio) {
      if (ratioBeforePanic === null) {
        ratioBeforePanic = currentRatio
        return PANIC_RATIO
      }
      const restored = ratioBeforePanic
      ratioBeforePanic = null
      return restored
    },
    isPanicked: () => ratioBeforePanic !== null,
  }
}
