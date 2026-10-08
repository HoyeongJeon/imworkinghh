import type { WindowBounds } from '../shared/types'

export type ScreenArea = { x: number; y: number; width: number; height: number }

const MIN_VISIBLE_WIDTH = 100
const MIN_VISIBLE_HEIGHT = 50

export function boundsIfVisible(bounds: WindowBounds | null, workAreas: ScreenArea[]): WindowBounds | null {
  if (!bounds) return null
  const isVisible = workAreas.some(
    (area) =>
      overlapLength(bounds.x, bounds.width, area.x, area.width) >= MIN_VISIBLE_WIDTH &&
      overlapLength(bounds.y, bounds.height, area.y, area.height) >= MIN_VISIBLE_HEIGHT,
  )
  return isVisible ? bounds : null
}

function overlapLength(start: number, length: number, areaStart: number, areaLength: number): number {
  return Math.min(start + length, areaStart + areaLength) - Math.max(start, areaStart)
}
