// 줄바꿈된 문단도 화면에 보이는 줄마다 번호를 매기기 위해, CodeMirror가 잰 높이를 줄 높이로 나눠 센다.

export function firstVisualRow(blockTop: number, lineHeight: number): number {
  return rowsBetween(0, blockTop, lineHeight) + 1
}

export function rowsBetween(fromTop: number, toTop: number, lineHeight: number): number {
  if (lineHeight <= 0) return 0
  return Math.max(0, Math.round((toTop - fromTop) / lineHeight))
}

export function visualRowNumbers(blockTop: number, blockHeight: number, lineHeight: number): number[] {
  const first = firstVisualRow(blockTop, lineHeight)
  const rowCount = Math.max(1, rowsBetween(0, blockHeight, lineHeight))
  return Array.from({ length: rowCount }, (_, index) => first + index)
}
