import { describe, expect, it } from 'vitest'
import { boundsIfVisible } from '../../src/main/window-bounds'

const laptopScreen = { x: 0, y: 0, width: 1920, height: 1040 }

describe('창 위치 복원', () => {
  it('저장된 위치가 화면 안에 있으면 그대로 쓴다', () => {
    const bounds = { x: 100, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(bounds, [laptopScreen])).toEqual(bounds)
  })

  it('모니터를 빼서 저장된 위치가 어느 화면에도 없으면 쓰지 않는다', () => {
    const onRemovedMonitor = { x: 2400, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(onRemovedMonitor, [laptopScreen])).toBeNull()
  })

  it('화면 가장자리에 조금만 걸쳐 있으면 쓰지 않는다', () => {
    const barelyVisible = { x: 1900, y: 100, width: 800, height: 600 }
    expect(boundsIfVisible(barelyVisible, [laptopScreen])).toBeNull()
  })

  it('제목 표시줄이 화면 위로 벗어나 창을 끌 수 없으면 쓰지 않는다', () => {
    const titlebarAboveScreen = { x: 100, y: -300, width: 1100, height: 760 }
    expect(boundsIfVisible(titlebarAboveScreen, [laptopScreen])).toBeNull()
  })

  it('두 번째 모니터에 있던 창은 그 모니터가 있으면 그대로 쓴다', () => {
    const secondScreen = { x: 1920, y: 0, width: 2560, height: 1400 }
    const bounds = { x: 2400, y: 100, width: 1100, height: 760 }
    expect(boundsIfVisible(bounds, [laptopScreen, secondScreen])).toEqual(bounds)
  })

  it('저장된 위치가 없으면 쓰지 않는다', () => {
    expect(boundsIfVisible(null, [laptopScreen])).toBeNull()
  })
})
