import type { LogSpeed } from '../../shared/types'
import type { FakeEvent } from './events'

export const SPEED_MULTIPLIERS: Record<LogSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5 }
export const TYPING_ACTIVE_WINDOW_MS = 3000
export const TYPING_IDLE_AFTER_MS = 15000
export const TYPING_ACTIVE_MULTIPLIER = 0.5
export const IDLE_THINKING_MS = 20000

export type TypingState = 'active' | 'normal' | 'idle'

export type TypingActivity = {
  markTyped(): void
  state(): TypingState
}

export function createTypingActivity(now: () => number): TypingActivity {
  let lastTypedAt = now()
  return {
    markTyped() {
      lastTypedAt = now()
    },
    state() {
      const elapsed = now() - lastTypedAt
      if (elapsed <= TYPING_ACTIVE_WINDOW_MS) return 'active'
      if (elapsed > TYPING_IDLE_AFTER_MS) return 'idle'
      return 'normal'
    },
  }
}

export function delayMultiplier({
  speed,
  typingLink,
  typingState,
}: {
  speed: LogSpeed
  typingLink: boolean
  typingState: TypingState
}): number {
  const typingFactor = typingLink && typingState === 'active' ? TYPING_ACTIVE_MULTIPLIER : 1
  return SPEED_MULTIPLIERS[speed] * typingFactor
}

export function withIdleThinking(nextEvent: () => FakeEvent, isIdle: () => boolean): () => FakeEvent {
  let thoughtDuringThisIdle = false
  return () => {
    if (!isIdle()) {
      thoughtDuringThisIdle = false
      return nextEvent()
    }
    if (thoughtDuringThisIdle) return nextEvent()
    thoughtDuringThisIdle = true
    return { kind: 'spinner', label: 'Thinking', durationMs: IDLE_THINKING_MS }
  }
}
