import { describe, expect, it } from 'vitest'
import { firstVisualRow, rowsBetween, visualRowNumbers } from '../../src/renderer/visual-lines'

const LINE_HEIGHT = 20

describe('화면 줄 번호', () => {
  it('접히지 않은 줄에는 번호 하나를 붙인다', () => {
    expect(visualRowNumbers(0, 20, LINE_HEIGHT)).toEqual([1])
  })

  it('세 줄로 접힌 문단에는 접힌 줄마다 번호를 붙인다', () => {
    expect(visualRowNumbers(0, 60, LINE_HEIGHT)).toEqual([1, 2, 3])
  })

  it('앞 문단이 차지한 화면 줄 수만큼 다음 문단 번호를 이어 붙인다', () => {
    expect(visualRowNumbers(60, 40, LINE_HEIGHT)).toEqual([4, 5])
  })

  it('높이에 소수점 오차가 있어도 가장 가까운 줄 수로 센다', () => {
    expect(visualRowNumbers(59.6, 40.3, LINE_HEIGHT)).toEqual([4, 5])
  })

  it('높이를 아직 재지 못했으면 번호 하나를 붙인다', () => {
    expect(visualRowNumbers(0, 0, 0)).toEqual([1])
  })
})

describe('커서가 있는 화면 줄', () => {
  it('문서 맨 위에서 떨어진 높이로 첫 화면 줄 번호를 정한다', () => {
    expect(firstVisualRow(100, LINE_HEIGHT)).toBe(6)
  })

  it('문단 첫 줄에서 커서 줄까지 내려간 화면 줄 수를 센다', () => {
    expect(rowsBetween(103, 143.5, LINE_HEIGHT)).toBe(2)
  })

  it('줄 높이를 아직 재지 못했으면 내려간 줄이 없다고 본다', () => {
    expect(rowsBetween(0, 40, 0)).toBe(0)
  })
})
