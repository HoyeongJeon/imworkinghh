import type { FakeEvent, LogSegment, LogSink } from './events'

export const SPINNER_FRAME_MS = 250
const SPINNER_GLYPHS = ['✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳']
const TYPE_OUT_FINAL_PAUSE_MS = 400
const SPINNER_RESULT_PAUSE_MS = 200

type Step = { render(sink: LogSink): void; waitMs: number }

export type Player = {
  start(): void
  pause(): void
  resume(): void
  isPaused(): boolean
}

export type PlayerOptions = {
  nextEvent: () => FakeEvent
  sink: LogSink
  delayMultiplier: () => number
}

export function createPlayer({ nextEvent, sink, delayMultiplier }: PlayerOptions): Player {
  let pendingSteps: Step[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let paused = false

  function playNextStep(): void {
    timer = null
    if (pendingSteps.length === 0) pendingSteps = stepsFor(nextEvent())
    const step = pendingSteps.shift()!
    step.render(sink)
    timer = setTimeout(playNextStep, step.waitMs * delayMultiplier())
  }

  return {
    start() {
      if (started) return
      started = true
      if (!paused) playNextStep()
    },
    pause() {
      paused = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    resume() {
      if (!paused) return
      paused = false
      if (started) playNextStep()
    },
    isPaused: () => paused,
  }
}

function stepsFor(event: FakeEvent): Step[] {
  switch (event.kind) {
    case 'line':
      return [{ render: (sink) => sink.appendLine(event.segments), waitMs: event.delayMs }]
    case 'typeOut':
      return typeOutSteps(event)
    case 'spinner':
      return spinnerSteps(event)
  }
}

function typeOutSteps({ text, role, charDelayMs }: Extract<FakeEvent, { kind: 'typeOut' }>): Step[] {
  const steps: Step[] = [{ render: (sink) => sink.appendLine([{ text: '', role }]), waitMs: charDelayMs }]
  for (let length = 1; length <= text.length; length++) {
    const segments: LogSegment[] = [{ text: text.slice(0, length), role }]
    const isLast = length === text.length
    steps.push({ render: (sink) => sink.replaceLastLine(segments), waitMs: isLast ? TYPE_OUT_FINAL_PAUSE_MS : charDelayMs })
  }
  return steps
}

function spinnerSteps({ label, durationMs }: Extract<FakeEvent, { kind: 'spinner' }>): Step[] {
  const frameCount = Math.max(1, Math.ceil(durationMs / SPINNER_FRAME_MS))
  const steps: Step[] = []
  for (let frame = 0; frame < frameCount; frame++) {
    const elapsedSeconds = Math.floor((frame * SPINNER_FRAME_MS) / 1000)
    const glyph = SPINNER_GLYPHS[frame % SPINNER_GLYPHS.length]
    const segments: LogSegment[] = [
      { text: `${glyph} ${label}… (${elapsedSeconds}s · esc to interrupt)`, role: 'thinking' },
    ]
    steps.push({
      render: (sink) => (frame === 0 ? sink.appendLine(segments) : sink.replaceLastLine(segments)),
      waitMs: SPINNER_FRAME_MS,
    })
  }
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  steps.push({
    render: (sink) => sink.replaceLastLine([{ text: `✻ ${label} for ${totalSeconds}s`, role: 'muted' }]),
    waitMs: SPINNER_RESULT_PAUSE_MS,
  })
  return steps
}
