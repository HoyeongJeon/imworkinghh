import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedTask } from '../../src/renderer/debounce'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('잠시 미뤄 한 번만 하는 작업', () => {
  it('잇따라 요청하면 마지막 요청 뒤 정한 시간이 지나야 한 번 실행한다', () => {
    const run = vi.fn()
    const task = createDebouncedTask(run, 200)
    task.schedule()
    vi.advanceTimersByTime(150)
    task.schedule()
    vi.advanceTimersByTime(150)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('지금 실행하면 기다리던 요청은 취소된다', () => {
    const run = vi.fn()
    const task = createDebouncedTask(run, 200)
    task.schedule()
    task.runNow()
    vi.advanceTimersByTime(500)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
