// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PANE_DIVIDER_PX, createPaneLayout } from '../../src/renderer/pane-dividers'

function setup() {
  const host = document.createElement('section')
  host.getBoundingClientRect = () => ({ left: 0, width: 1000 + PANE_DIVIDER_PX }) as DOMRect
  const committed: number[][] = []
  const layout = createPaneLayout({ host, minPanePx: 200, onWidthsCommitted: (widths) => committed.push(widths) })
  const pane = (name: string) => {
    const element = document.createElement('div')
    element.dataset.name = name
    return element
  }
  const childNames = () => [...host.children].map((child) => (child as HTMLElement).dataset.name ?? 'divider')
  return { host, layout, committed, pane, childNames }
}

describe('칸 배치', () => {
  it('칸 사이마다 세로 막대를 하나씩 둔다', () => {
    const { layout, pane, childNames } = setup()
    layout.render([pane('a'), pane('b'), pane('c')], [0.2, 0.3, 0.5])
    expect(childNames()).toEqual(['a', 'divider', 'b', 'divider', 'c'])
  })

  it('칸이 하나면 막대가 없다', () => {
    const { layout, pane, childNames } = setup()
    const a = pane('a')
    layout.render([a, pane('b')], [0.5, 0.5])
    layout.render([a], [1])
    expect(childNames()).toEqual(['a'])
  })

  it('칸 너비 비율대로 열 너비를 정한다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.3, 0.7])
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.3fr) ${PANE_DIVIDER_PX}px minmax(0, 0.7fr)`)
  })

  it('칸을 빼도 남아 있는 칸 요소는 떼었다 붙이지 않는다', () => {
    const { host, layout, pane } = setup()
    const a = pane('a')
    const b = pane('b')
    layout.render([a, b], [0.5, 0.5])
    const observer = new MutationObserver(() => undefined)
    observer.observe(host, { childList: true })
    a.remove()
    layout.render([b], [1])
    const removed = observer.takeRecords().flatMap((record) => [...record.removedNodes])
    expect(removed).not.toContain(b)
    expect(host.children[0]).toBe(b)
  })

  it('칸 막대는 세로 구분선으로 알린다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    expect(divider.className).toBe('pane-divider')
    expect(divider.getAttribute('role')).toBe('separator')
    expect(divider.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('막대를 끌면 양옆 칸 너비가 바뀌고 놓으면 바뀐 비율을 알린다', () => {
    const { host, layout, pane, committed } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 + PANE_DIVIDER_PX / 2 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.3fr) ${PANE_DIVIDER_PX}px minmax(0, 0.7fr)`)
    divider.dispatchEvent(new MouseEvent('pointerup', { clientX: 300 }))
    expect(committed).toEqual([[0.3, 0.7]])
  })

  it('막대를 끌어도 칸은 최소 너비보다 좁아지지 않는다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 50 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.2fr) ${PANE_DIVIDER_PX}px minmax(0, 0.8fr)`)
  })

  it('놓은 뒤에는 움직여도 너비가 바뀌지 않는다', () => {
    const { host, layout, pane } = setup()
    layout.render([pane('a'), pane('b')], [0.5, 0.5])
    const divider = host.children[1]
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointerup', { clientX: 503 }))
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 }))
    expect(host.style.gridTemplateColumns).toBe(`minmax(0, 0.5fr) ${PANE_DIVIDER_PX}px minmax(0, 0.5fr)`)
  })

  it('창 너비를 알려 준다', () => {
    expect(setup().layout.hostWidth()).toBe(1000 + PANE_DIVIDER_PX)
  })
})
