import type { WindowBounds } from '../shared/types'

export type ScreenArea = { x: number; y: number; width: number; height: number }

const MIN_VISIBLE_WIDTH = 100
// 제목 표시줄을 잡고 끌 수 있으려면 창 맨 위 이만큼이 화면 안에 있어야 한다.
const TITLEBAR_HEIGHT = 32

export function boundsIfVisible(bounds: WindowBounds | null, workAreas: ScreenArea[]): WindowBounds | null {
  if (!bounds) return null
  const isTitlebarVisible = workAreas.some(
    (area) =>
      overlapLength(bounds.x, bounds.width, area.x, area.width) >= MIN_VISIBLE_WIDTH &&
      bounds.y >= area.y &&
      bounds.y + TITLEBAR_HEIGHT <= area.y + area.height,
  )
  return isTitlebarVisible ? bounds : null
}

function overlapLength(start: number, length: number, areaStart: number, areaLength: number): number {
  return Math.min(start + length, areaStart + areaLength) - Math.max(start, areaStart)
}
