import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/renderer/fake/rng'

describe('시드 고정 난수', () => {
  it('같은 시드면 같은 순서의 수를 만든다', () => {
    const first = createRng(42)
    const second = createRng(42)
    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()])
  })

  it('수는 0 이상 1 미만이다', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('정수는 양 끝을 포함한 범위 안에서 나온다', () => {
    const rng = createRng(1)
    const values = new Set(Array.from({ length: 500 }, () => rng.int(4, 6)))
    expect([...values].sort()).toEqual([4, 5, 6])
  })

  it('목록에서 고른 값은 항상 목록 안에 있다', () => {
    const rng = createRng(3)
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
  })
})
