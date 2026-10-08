import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeEvent, LogSegment, LogSink } from '../../../src/renderer/fake/events'
import { createPlayer } from '../../../src/renderer/fake/player'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function createRecordingSink() {
  const lines: string[] = []
  const textOf = (segments: LogSegment[]) => segments.map((segment) => segment.text).join('')
  const sink: LogSink = {
    appendLine: (segments) => {
      lines.push(textOf(segments))
    },
    replaceLastLine: (segments) => {
      lines[lines.length - 1] = textOf(segments)
    },
  }
  return { sink, lines }
}

function eventsInOrder(events: FakeEvent[]): () => FakeEvent {
  let index = 0
  return () => events[index++ % events.length]
}

const textLine = (text: string, delayMs = 100): FakeEvent => ({
  kind: 'line',
  segments: [{ text, role: 'result' }],
  delayMs,
})

describe('가짜 세션 출력기', () => {
  it('시작하면 첫 줄을 바로 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a')]), sink, delayMultiplier: () => 1 }).start()
    expect(lines).toEqual(['a'])
  })

  it('줄마다 정해진 시간만큼 기다린 뒤 다음 줄을 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 1 }).start()
    vi.advanceTimersByTime(99)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(1)
    expect(lines).toEqual(['a', 'b'])
  })

  it('대기 시간에 속도 배율을 곱한다', () => {
    const { sink, lines } = createRecordingSink()
    createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 2 }).start()
    vi.advanceTimersByTime(100)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(100)
    expect(lines).toEqual(['a', 'b'])
  })

  it('타이핑 이벤트는 한 글자씩 늘어나며 같은 줄을 고쳐 쓴다', () => {
    const { sink, lines } = createRecordingSink()
    const typeOut: FakeEvent = { kind: 'typeOut', text: 'abc', role: 'userInput', charDelayMs: 10 }
    createPlayer({ nextEvent: eventsInOrder([typeOut]), sink, delayMultiplier: () => 1 }).start()
    expect(lines).toEqual([''])
    vi.advanceTimersByTime(10)
    expect(lines).toEqual(['a'])
    vi.advanceTimersByTime(20)
    expect(lines).toEqual(['abc'])
  })

  it('생각 중 표시는 같은 줄에서 경과 초를 올리고 끝나면 걸린 시간을 남긴다', () => {
    const { sink, lines } = createRecordingSink()
    const spinner: FakeEvent = { kind: 'spinner', label: 'Thinking', durationMs: 2000 }
    createPlayer({ nextEvent: eventsInOrder([spinner, textLine('next')]), sink, delayMultiplier: () => 1 }).start()
    expect(lines[0]).toContain('Thinking… (0s')
    vi.advanceTimersByTime(1000)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Thinking… (1s')
    vi.advanceTimersByTime(1000)
    expect(lines[0]).toBe('✻ Thinking for 2s')
  })

  it('일시정지하면 더 출력하지 않는다', () => {
    const { sink, lines } = createRecordingSink()
    const player = createPlayer({ nextEvent: eventsInOrder([textLine('a'), textLine('b')]), sink, delayMultiplier: () => 1 })
    player.start()
    player.pause()
    vi.advanceTimersByTime(10_000)
    expect(lines).toEqual(['a'])
    expect(player.isPaused()).toBe(true)
  })

  it('재개하면 멈춘 다음 줄부터 이어서 출력한다', () => {
    const { sink, lines } = createRecordingSink()
    const player = createPlayer({
      nextEvent: eventsInOrder([textLine('a'), textLine('b'), textLine('c')]),
      sink,
      delayMultiplier: () => 1,
    })
    player.start()
    player.pause()
    player.resume()
    expect(lines).toEqual(['a', 'b'])
    expect(player.isPaused()).toBe(false)
  })
})
