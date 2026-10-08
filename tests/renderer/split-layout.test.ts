import { describe, expect, it } from 'vitest'
import { PANIC_RATIO, clampTopPaneHeight, createPanicToggle, ratioFromPointer } from '../../src/renderer/split-layout'

describe('분할 크기 계산', () => {
  it('끌어 놓은 위치의 비율로 나눈다', () => {
    expect(ratioFromPointer(300, 600)).toBe(0.5)
  })

  it('위 영역은 최소 80px보다 작아지지 않는다', () => {
    expect(clampTopPaneHeight(10, 600)).toBe(80)
  })

  it('아래 영역도 최소 80px보다 작아지지 않는다', () => {
    expect(clampTopPaneHeight(590, 600)).toBe(520)
  })

  it('창이 최소 크기 두 배보다 작으면 반씩 나눈다', () => {
    expect(clampTopPaneHeight(10, 120)).toBe(60)
  })

  it('높이를 알 수 없으면 반씩 나눈다', () => {
    expect(ratioFromPointer(100, 0)).toBe(0.5)
  })
})

describe('패닉 접기', () => {
  it('누르면 에디터를 접고 가짜 세션이 전체를 차지한다', () => {
    const panic = createPanicToggle()
    expect(panic.toggle(0.55)).toBe(PANIC_RATIO)
    expect(panic.isPanicked()).toBe(true)
  })

  it('다시 누르면 원래 비율로 되돌린다', () => {
    const panic = createPanicToggle()
    panic.toggle(0.42)
    expect(panic.toggle(PANIC_RATIO)).toBe(0.42)
    expect(panic.isPanicked()).toBe(false)
  })
})
