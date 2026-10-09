export const PLAIN_APP_NAME = 'md-writer'

export type WindowTitleInput = {
  stealthMode: boolean
  disguisedTitle: string
  documentName: string
  dirty: boolean
}

export function windowTitleFor({ stealthMode, disguisedTitle, documentName, dirty }: WindowTitleInput): string {
  if (stealthMode) return disguisedTitle
  return `${documentName}${dirty ? ' ●' : ''} - ${PLAIN_APP_NAME}`
}

export type PausableSession = { pause(): void; resume(): void; isPaused(): boolean }

export type SessionHider = { hide(): void; show(): void }

export function createSessionHider(session: PausableSession): SessionHider {
  let pausedBeforeHiding: boolean | null = null
  return {
    hide() {
      if (pausedBeforeHiding !== null) return
      pausedBeforeHiding = session.isPaused()
      session.pause()
    },
    show() {
      if (pausedBeforeHiding === null) return
      if (!pausedBeforeHiding) session.resume()
      pausedBeforeHiding = null
    },
  }
}
