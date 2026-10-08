import { describe, expect, it } from 'vitest'
import type { FakeEvent } from '../../../src/renderer/fake/events'
import {
  IDLE_THINKING_MS,
  createTypingActivity,
  delayMultiplier,
  withIdleThinking,
} from '../../../src/renderer/fake/pacing'

function createClock() {
  let time = 0
  return { now: () => time, advance: (ms: number) => (time += ms) }
}

const normalEvent: FakeEvent = { kind: 'line', segments: [{ text: 'log', role: 'result' }], delayMs: 100 }

describe('로그 속도', () => {
  it('느림은 1.6배, 보통은 1배, 빠름은 0.5배로 기다린다', () => {
    expect(delayMultiplier({ speed: 'slow', typingLink: false, typingState: 'normal' })).toBe(1.6)
    expect(delayMultiplier({ speed: 'normal', typingLink: false, typingState: 'normal' })).toBe(1)
    expect(delayMultiplier({ speed: 'fast', typingLink: false, typingState: 'normal' })).toBe(0.5)
  })
})

describe('타이핑 연동', () => {
  it('마지막 입력 후 3초 안이면 입력 중 상태다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    activity.markTyped()
    clock.advance(3000)
    expect(activity.state()).toBe('active')
  })

  it('3초가 지나면 보통 상태로 돌아간다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    activity.markTyped()
    clock.advance(3001)
    expect(activity.state()).toBe('normal')
  })

  it('15초 넘게 입력이 없으면 쉬는 상태다', () => {
    const clock = createClock()
    const activity = createTypingActivity(clock.now)
    clock.advance(15_001)
    expect(activity.state()).toBe('idle')
  })

  it('입력 중이면 로그가 두 배 빨라진다', () => {
    expect(delayMultiplier({ speed: 'normal', typingLink: true, typingState: 'active' })).toBe(0.5)
  })

  it('타이핑 연동을 끄면 입력 중이어도 속도가 그대로다', () => {
    expect(delayMultiplier({ speed: 'normal', typingLink: false, typingState: 'active' })).toBe(1)
  })

  it('쉬는 상태가 되면 다음 이벤트로 긴 생각 중 표시를 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => true)
    expect(next()).toEqual({ kind: 'spinner', label: 'Thinking', durationMs: IDLE_THINKING_MS })
  })

  it('긴 생각 중 표시는 쉬는 동안 한 번만 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => true)
    next()
    expect(next()).toBe(normalEvent)
    expect(next()).toBe(normalEvent)
  })

  it('다시 입력하고 또 쉬면 긴 생각 중 표시를 다시 낸다', () => {
    let idle = true
    const next = withIdleThinking(() => normalEvent, () => idle)
    next()
    idle = false
    next()
    idle = true
    expect(next().kind).toBe('spinner')
  })

  it('쉬는 상태가 아니면 원래 이벤트를 그대로 낸다', () => {
    const next = withIdleThinking(() => normalEvent, () => false)
    expect(next()).toBe(normalEvent)
  })
})
