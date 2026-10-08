import { describe, expect, it } from 'vitest'
import { createOpenRequestQueue } from '../../src/main/open-requests'

function setup() {
  const delivered: string[] = []
  return { delivered, queue: createOpenRequestQueue((path) => delivered.push(path)) }
}

describe('파일 열기 요청 전달', () => {
  it('화면이 준비되기 전에 들어온 요청은 보관했다가 화면이 가져간다', () => {
    const { queue, delivered } = setup()
    queue.request('/notes/a.md')
    expect(delivered).toEqual([])
    expect(queue.takePending()).toBe('/notes/a.md')
  })

  it('화면이 가져간 뒤 들어온 요청은 바로 전달한다', () => {
    const { queue, delivered } = setup()
    queue.takePending()
    queue.request('/notes/b.md')
    expect(delivered).toEqual(['/notes/b.md'])
  })

  it('보관한 요청은 한 번만 넘긴다', () => {
    const { queue } = setup()
    queue.request('/notes/a.md')
    queue.takePending()
    expect(queue.takePending()).toBeNull()
  })

  it('준비 전에 여러 번 들어오면 마지막 요청만 남긴다', () => {
    const { queue } = setup()
    queue.request('/notes/a.md')
    queue.request('/notes/b.md')
    expect(queue.takePending()).toBe('/notes/b.md')
  })
})
