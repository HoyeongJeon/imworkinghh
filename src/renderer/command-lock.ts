export type GuardedCommand<Args extends unknown[]> = (...args: Args) => Promise<boolean>

export type CommandLock = {
  unlessBusy<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
  afterRunning<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args>
}

export function createCommandLock(): CommandLock {
  let running: Promise<boolean> | null = null

  function track(command: Promise<boolean>): Promise<boolean> {
    running = command
    const clear = () => {
      if (running === command) running = null
    }
    command.then(clear, clear)
    return command
  }

  // 저장 창 같은 대화 상자가 떠 있는 동안 단축키를 또 누르면 창이 겹쳐 뜨므로, 진행 중인 명령이 있으면 무시한다.
  function unlessBusy<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args> {
    return (...args) => (running ? Promise.resolve(false) : track(command(...args)))
  }

  // 다른 프로그램에서 연 파일은 다시 요청할 방법이 없으므로 버리지 않고 진행 중인 명령이 끝나기를 기다린다.
  function afterRunning<Args extends unknown[]>(command: GuardedCommand<Args>): GuardedCommand<Args> {
    return async (...args) => {
      while (running) await running.catch(() => false)
      return track(command(...args))
    }
  }

  return { unlessBusy, afterRunning }
}
