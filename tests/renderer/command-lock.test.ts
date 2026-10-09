import { describe, expect, it } from 'vitest'
import { createCommandLock } from '../../src/renderer/command-lock'

function deferred() {
  let resolve: (value: boolean) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('명령 잠금', () => {
  it('명령이 진행 중이면 다른 명령은 실행하지 않고 거절한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    let secondRuns = 0
    const running = lock.unlessBusy(() => first.promise)()
    const second = lock.unlessBusy(async () => {
      secondRuns++
      return true
    })
    expect(await second()).toBe(false)
    expect(secondRuns).toBe(0)
    first.resolve(true)
    expect(await running).toBe(true)
  })

  it('진행 중인 명령이 끝나면 다음 명령을 받는다', async () => {
    const lock = createCommandLock()
    await lock.unlessBusy(async () => true)()
    expect(await lock.unlessBusy(async () => true)()).toBe(true)
  })

  it('기다리는 명령은 진행 중인 명령이 끝난 뒤에 실행한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    const order: string[] = []
    void lock.unlessBusy(async () => {
      const value = await first.promise
      order.push('first')
      return value
    })()
    const waiting = lock.afterRunning(async () => {
      order.push('waiting')
      return true
    })()
    await Promise.resolve()
    expect(order).toEqual([])
    first.resolve(true)
    expect(await waiting).toBe(true)
    expect(order).toEqual(['first', 'waiting'])
  })

  it('진행 중인 명령이 실패해도 기다리던 명령은 실행한다', async () => {
    const lock = createCommandLock()
    const first = deferred()
    const failing = lock.unlessBusy(() => first.promise)()
    const waiting = lock.afterRunning(async () => true)()
    first.reject(new Error('disk'))
    await expect(failing).rejects.toThrow('disk')
    expect(await waiting).toBe(true)
  })
})
