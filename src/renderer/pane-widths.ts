export const MIN_PANE_WIDTH_PX = 240

export function equalWidths(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count)
}

// 칸이 3개 이상이면 이미 좁은 칸을 반으로 나눌 수 있어, 그때는 최소 너비를 지키도록 모두 같은 너비로 나눈다.
export function widthsAfterAdd(widths: readonly number[], afterIndex: number, minRatio: number): number[] {
  const half = widths[afterIndex] / 2
  if (half < minRatio) return equalWidths(widths.length + 1)
  const next = [...widths]
  next.splice(afterIndex, 1, half, half)
  return next
}

export function widthsAfterRemove(widths: readonly number[], index: number): number[] {
  if (widths.length <= 1) return [1]
  const receiver = index === 0 ? 1 : index - 1
  const next = [...widths]
  next[receiver] += next[index]
  next.splice(index, 1)
  return next
}

export function widthsAfterDrag(
  widths: readonly number[],
  dividerIndex: number,
  pointerRatio: number,
  minRatio: number,
): number[] {
  const left = dividerIndex
  const right = dividerIndex + 1
  const pairTotal = widths[left] + widths[right]
  if (pairTotal < minRatio * 2) return [...widths]
  const pairStart = widths.slice(0, left).reduce((sum, width) => sum + width, 0)
  const leftWidth = Math.min(pairTotal - minRatio, Math.max(minRatio, pointerRatio - pairStart))
  const next = [...widths]
  next[left] = leftWidth
  next[right] = pairTotal - leftWidth
  return next
}

export function canAddPane(count: number, availablePx: number, minPanePx: number): boolean {
  return availablePx >= (count + 1) * minPanePx
}
