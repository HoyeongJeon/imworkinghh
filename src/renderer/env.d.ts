import type { ImworkingApi } from '../shared/api'

declare global {
  interface Window {
    imworking: ImworkingApi
  }
}

export {}
