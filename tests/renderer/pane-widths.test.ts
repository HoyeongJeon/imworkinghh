import { describe, expect, it } from 'vitest'
import {
  MIN_PANE_WIDTH_PX,
  canAddPane,
  equalWidths,
  widthsAfterAdd,
  widthsAfterDrag,
  widthsAfterRemove,
} from '../../src/renderer/pane-widths'

const rounded = (widths: number[]) => widths.map((width) => Math.round(width * 1000) / 1000)

describe('칸 너비', () => {
  it('칸 최소 너비는 240px이다', () => {
    expect(MIN_PANE_WIDTH_PX).toBe(240)
  })

  it('같은 너비로 나누면 칸마다 같은 비율을 받는다', () => {
    expect(equalWidths(2)).toEqual([0.5, 0.5])
    expect(rounded(equalWidths(3))).toEqual([0.333, 0.333, 0.333])
  })

  it('칸을 더하면 지금 칸의 너비를 반으로 나눠 새 칸에 준다', () => {
    expect(rounded(widthsAfterAdd([0.6, 0.4], 0, 0.1))).toEqual([0.3, 0.3, 0.4])
  })

  it('반으로 나눈 너비가 최소 너비보다 좁으면 모든 칸을 같은 너비로 나눈다', () => {
    expect(rounded(widthsAfterAdd([0.8, 0.2], 1, 0.15))).toEqual([0.333, 0.333, 0.333])
  })

  it('칸을 닫으면 그 너비를 왼쪽 칸에 준다', () => {
    expect(rounded(widthsAfterRemove([0.2, 0.3, 0.5], 2))).toEqual([0.2, 0.8])
  })

  it('첫 칸을 닫으면 그 너비를 오른쪽 칸에 준다', () => {
    expect(rounded(widthsAfterRemove([0.3, 0.2, 0.5], 0))).toEqual([0.5, 0.5])
  })

  it('막대를 끌면 양옆 두 칸의 너비만 바뀐다', () => {
    expect(rounded(widthsAfterDrag([0.2, 0.3, 0.5], 1, 0.6, 0.1))).toEqual([0.2, 0.4, 0.4])
  })

  it('막대를 끌어도 칸은 최소 너비보다 좁아지지 않는다', () => {
    expect(rounded(widthsAfterDrag([0.5, 0.5], 0, 0.01, 0.2))).toEqual([0.2, 0.8])
    expect(rounded(widthsAfterDrag([0.5, 0.5], 0, 0.99, 0.2))).toEqual([0.8, 0.2])
  })

  it('두 칸을 합쳐도 최소 너비 두 개가 안 되면 막대를 끌어도 그대로 둔다', () => {
    expect(widthsAfterDrag([0.1, 0.1, 0.8], 0, 0.15, 0.2)).toEqual([0.1, 0.1, 0.8])
  })

  it('창 너비가 모든 칸의 최소 너비를 담을 수 있을 때만 칸을 더할 수 있다', () => {
    expect(canAddPane(1, 480, 240)).toBe(true)
    expect(canAddPane(1, 479, 240)).toBe(false)
    expect(canAddPane(2, 720, 240)).toBe(true)
    expect(canAddPane(1, 0, 240)).toBe(false)
  })
})
