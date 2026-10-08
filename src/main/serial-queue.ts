export type SerialQueue = { run<T>(task: () => Promise<T>): Promise<T> }

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    run(task) {
      const result = tail.then(task, task)
      tail = result.catch(() => undefined)
      return result
    },
  }
}
