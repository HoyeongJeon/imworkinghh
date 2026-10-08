export type OpenRequestQueue = {
  request(path: string): void
  takePending(): string | null
}

export function createOpenRequestQueue(deliver: (path: string) => void): OpenRequestQueue {
  let pendingPath: string | null = null
  let rendererReady = false
  return {
    request(path) {
      if (rendererReady) deliver(path)
      else pendingPath = path
    },
    takePending() {
      rendererReady = true
      const path = pendingPath
      pendingPath = null
      return path
    },
  }
}
