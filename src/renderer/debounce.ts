export type DebouncedTask = {
  schedule(): void
  runNow(): void
  cancel(): void
}

export function createDebouncedTask(run: () => void, delayMs: number): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return {
    schedule() {
      cancel()
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    runNow() {
      cancel()
      run()
    },
    cancel,
  }
}
