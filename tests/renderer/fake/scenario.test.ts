import { describe, expect, it } from 'vitest'
import type { FakeEvent } from '../../../src/renderer/fake/events'
import { createRng } from '../../../src/renderer/fake/rng'
import { TOOL_CALLS_PER_TASK, createSessionStream, generateTask } from '../../../src/renderer/fake/scenario'

type LineEvent = Extract<FakeEvent, { kind: 'line' }>

const testPrompt = (project: string) => `TEST[${project}]>`
const linesOf = (events: FakeEvent[]) => events.filter((event): event is LineEvent => event.kind === 'line')
const countToolCalls = (events: FakeEvent[]) =>
  linesOf(events).filter((line) => line.segments[0]?.role === 'toolBullet').length

describe('가짜 작업 생성', () => {
  it('같은 시드면 같은 작업을 만든다', () => {
    expect(generateTask(createRng(5), testPrompt)).toEqual(generateTask(createRng(5), testPrompt))
  })

  it('다른 시드면 다른 작업을 만든다', () => {
    expect(generateTask(createRng(5), testPrompt)).not.toEqual(generateTask(createRng(6), testPrompt))
  })

  it('작업은 프롬프트 줄, 요청 타이핑, 생각 중 표시 순서로 시작한다', () => {
    const [promptLine, , request, thinking] = generateTask(createRng(1), testPrompt)
    expect(promptLine.kind).toBe('line')
    expect(request.kind === 'typeOut' && request.text.startsWith('> ')).toBe(true)
    expect(thinking.kind).toBe('spinner')
  })

  it('프롬프트 줄은 주입한 함수가 만든 프롬프트를 쓴다', () => {
    const [promptLine] = generateTask(createRng(1), testPrompt)
    expect(promptLine.kind === 'line' && promptLine.segments[0].text).toMatch(/^TEST\[.+\]>$/)
  })

  it('도구 호출은 한 작업에 4개 이상 10개 이하다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const count = countToolCalls(generateTask(createRng(seed), testPrompt))
      expect(count).toBeGreaterThanOrEqual(TOOL_CALLS_PER_TASK.min)
      expect(count).toBeLessThanOrEqual(TOOL_CALLS_PER_TASK.max)
    }
  })

  it('작업은 성공 요약으로 끝난다', () => {
    const nonBlankLines = linesOf(generateTask(createRng(9), testPrompt)).filter((line) => line.segments.length > 0)
    expect(nonBlankLines.at(-1)?.segments[0].role).toBe('success')
  })

  it('모든 대기 시간은 0 이상이다', () => {
    for (const event of generateTask(createRng(11), testPrompt)) {
      const wait =
        event.kind === 'line' ? event.delayMs : event.kind === 'typeOut' ? event.charDelayMs : event.durationMs
      expect(wait).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('가짜 세션 흐름', () => {
  it('작업이 끝나면 이어서 다음 작업을 만든다', () => {
    const next = createSessionStream(3, testPrompt)
    const events = Array.from({ length: 2000 }, next)
    const promptLines = linesOf(events).filter((line) => line.segments[0]?.role === 'prompt')
    expect(promptLines.length).toBeGreaterThanOrEqual(2)
  })

  it('같은 시드의 세션은 같은 순서로 이벤트를 낸다', () => {
    const first = createSessionStream(8, testPrompt)
    const second = createSessionStream(8, testPrompt)
    expect(Array.from({ length: 300 }, first)).toEqual(Array.from({ length: 300 }, second))
  })
})
