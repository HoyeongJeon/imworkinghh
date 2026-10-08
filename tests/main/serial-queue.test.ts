import { describe, expect, it } from 'vitest'
import { createSerialQueue } from '../../src/main/serial-queue'

describe('순서대로 실행하는 작업 줄', () => {
  it('먼저 넣은 작업이 끝나야 다음 작업을 시작한다', async () => {
    const queue = createSerialQueue()
    const events: string[] = []
    let finishFirst: () => void = () => undefined
    const first = queue.run(async () => {
      events.push('first start')
      await new Promise<void>((resolve) => (finishFirst = resolve))
      events.push('first end')
    })
    const second = queue.run(async () => {
      events.push('second start')
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['first start'])
    finishFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first start', 'first end', 'second start'])
  })

  it('앞 작업이 실패해도 다음 작업은 실행한다', async () => {
    const queue = createSerialQueue()
    const failed = queue.run(async () => {
      throw new Error('잠김')
    })
    await expect(failed).rejects.toThrow('잠김')
    expect(await queue.run(async () => 'done')).toBe('done')
  })
})
