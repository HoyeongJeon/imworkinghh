import { describe, expect, it } from 'vitest'
import { createPaneSet, type PaneChange } from '../../src/renderer/pane-set'

function setup(maxPanes = 2) {
  let nextId = 1
  const destroyed: number[] = []
  const changes: PaneChange[] = []
  const panes = createPaneSet<{ id: number }>({
    maxPanes,
    createPane: () => ({ id: nextId++ }),
    destroyPane: (pane) => destroyed.push(pane.id),
    onChanged: (change) => changes.push(change),
  })
  const ids = () => panes.all().map((pane) => pane.id)
  const paneById = (id: number) => panes.all().find((pane) => pane.id === id)!
  return { panes, destroyed, changes, ids, paneById }
}

describe('칸 목록', () => {
  it('처음에는 칸 하나가 지금 칸이다', () => {
    const { panes, ids, changes } = setup()
    expect(ids()).toEqual([1])
    expect(panes.focused().id).toBe(1)
    expect(changes).toEqual([])
  })

  it('칸을 더하면 지금 칸 오른쪽에 생기고 새 칸이 지금 칸이 된다', () => {
    const { panes, ids, changes, paneById } = setup(3)
    panes.add()
    panes.focus(paneById(1))
    const added = panes.add()
    expect(ids()).toEqual([1, 3, 2])
    expect(panes.focused()).toBe(added)
    expect(changes.at(-1)).toEqual({ kind: 'added', index: 1 })
  })

  it('최대 칸 수면 칸을 더하지 않는다', () => {
    const { panes, ids } = setup(2)
    panes.add()
    expect(panes.add()).toBeNull()
    expect(ids()).toEqual([1, 2])
  })

  it('최대 칸 수가 3이면 세 칸까지 더한다', () => {
    const { panes, ids } = setup(3)
    panes.add()
    panes.add()
    expect(panes.add()).toBeNull()
    expect(ids()).toEqual([1, 2, 3])
  })

  it('마지막 한 칸은 닫지 않는다', () => {
    const { panes, destroyed } = setup()
    expect(panes.remove(panes.focused())).toBe(false)
    expect(destroyed).toEqual([])
  })

  it('지금 칸을 닫으면 없애고 왼쪽 칸이 지금 칸이 된다', () => {
    const { panes, ids, destroyed, changes, paneById } = setup(3)
    panes.add()
    panes.add()
    expect(panes.remove(paneById(3))).toBe(true)
    expect(ids()).toEqual([1, 2])
    expect(destroyed).toEqual([3])
    expect(panes.focused().id).toBe(2)
    expect(changes.at(-1)).toEqual({ kind: 'removed', index: 2 })
  })

  it('첫 칸을 닫으면 오른쪽 칸이 지금 칸이 된다', () => {
    const { panes, paneById } = setup()
    panes.add()
    panes.focus(paneById(1))
    panes.remove(paneById(1))
    expect(panes.focused().id).toBe(2)
  })

  it('지금 칸이 아닌 칸을 닫으면 지금 칸은 그대로다', () => {
    const { panes, paneById } = setup(3)
    panes.add()
    panes.add()
    panes.remove(paneById(1))
    expect(panes.focused().id).toBe(3)
  })

  it('다음 칸으로 옮기면 마지막 칸 다음은 첫 칸이다', () => {
    const { panes } = setup(3)
    panes.add()
    panes.add()
    panes.focusNext()
    expect(panes.focused().id).toBe(1)
    panes.focusNext()
    expect(panes.focused().id).toBe(2)
  })

  it('지금 칸이 바뀌면 바뀌었다고 알리고, 이미 지금 칸인 칸을 고르면 알리지 않는다', () => {
    const { panes, changes, paneById } = setup()
    panes.add()
    const before = changes.length
    panes.focus(paneById(2))
    expect(changes).toHaveLength(before)
    panes.focus(paneById(1))
    expect(changes.at(-1)).toEqual({ kind: 'focused' })
  })
})
