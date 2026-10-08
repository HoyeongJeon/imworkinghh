// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { SPLIT_HANDLE_PX, createSplitter } from '../../src/renderer/splitter'

function setup(initialRatio = 0.55) {
  const container = document.createElement('div')
  const handle = document.createElement('div')
  container.append(handle)
  container.getBoundingClientRect = () => ({ top: 0, height: 400 + SPLIT_HANDLE_PX }) as DOMRect
  const committed: number[] = []
  const splitter = createSplitter({ container, handle, initialRatio, onRatioCommitted: (ratio) => committed.push(ratio) })
  return { container, handle, splitter, committed }
}

describe('분할 막대', () => {
  it('처음 비율을 화면에 적용한다', () => {
    const { container, splitter } = setup(0.55)
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.55')
    expect(splitter.getRatio()).toBe(0.55)
  })

  it('막대를 끌면 위아래 비율이 바뀌고 놓으면 바뀐 비율을 알린다', () => {
    const { container, handle, committed } = setup()
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 200 }))
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.5')
    handle.dispatchEvent(new MouseEvent('pointerup', { clientY: 200 }))
    expect(committed).toEqual([0.5])
  })

  it('놓은 뒤에는 움직여도 비율이 바뀌지 않는다', () => {
    const { container, handle } = setup()
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointerup', { clientY: 220 }))
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 100 }))
    expect(container.style.getPropertyValue('--split-ratio')).toBe('0.55')
  })
})
