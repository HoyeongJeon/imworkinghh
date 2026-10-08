import type { FakeEvent, LogSegment } from './events'
import {
  COMMAND_RUNS,
  DIFF_CHANGES,
  DOC_URLS,
  FILE_PATHS,
  GLOB_PATTERNS,
  PROJECTS,
  REQUESTS,
  SEARCH_QUERIES,
  SPINNER_LABELS,
  SUMMARIES,
  SYMBOLS,
  TODO_ITEMS,
} from './pools'
import { createRng, type Rng } from './rng'

export type PromptForProject = (project: string) => string

export const TOOL_CALLS_PER_TASK = { min: 4, max: 10 }

type ToolStep = (rng: Rng) => FakeEvent[]

function line(segments: LogSegment[], delayMs: number): FakeEvent {
  return { kind: 'line', segments, delayMs }
}

function blankLine(delayMs: number): FakeEvent {
  return line([], delayMs)
}

function toolCall(name: string, argument: string | null, delayMs: number): FakeEvent {
  const segments: LogSegment[] = [
    { text: '● ', role: 'toolBullet' },
    { text: name, role: 'toolName' },
  ]
  if (argument !== null) segments.push({ text: `(${argument})`, role: 'toolArg' })
  return line(segments, delayMs)
}

function toolResult(text: string, rng: Rng): FakeEvent {
  return line(
    [
      { text: '  ⎿  ', role: 'muted' },
      { text, role: 'result' },
    ],
    rng.int(400, 1200),
  )
}

const grepStep: ToolStep = (rng) => [
  toolCall('Grep', `pattern: "${rng.pick(SYMBOLS)}", path: "src/"`, rng.int(250, 700)),
  toolResult(`Found ${rng.int(2, 14)} files`, rng),
]

const globStep: ToolStep = (rng) => [
  toolCall('Glob', `pattern: "${rng.pick(GLOB_PATTERNS)}"`, rng.int(250, 700)),
  toolResult(`Found ${rng.int(8, 120)} files`, rng),
]

const readStep: ToolStep = (rng) => [
  toolCall('Read', rng.pick(FILE_PATHS), rng.int(250, 700)),
  toolResult(`Read ${rng.int(40, 480)} lines`, rng),
]

const updateStep: ToolStep = (rng) => {
  const path = rng.pick(FILE_PATHS)
  const change = rng.pick(DIFF_CHANGES)
  const firstLineNumber = rng.int(12, 240)
  const diffLine = (sign: '-' | '+', code: string, offset: number): FakeEvent =>
    line(
      [
        {
          text: `      ${String(firstLineNumber + offset).padStart(4)} ${sign} ${code}`,
          role: sign === '-' ? 'diffRemove' : 'diffAdd',
        },
      ],
      60,
    )
  return [
    toolCall('Update', path, rng.int(250, 700)),
    toolResult(`Updated ${path} with ${change.added.length} additions and ${change.removed.length} removals`, rng),
    ...change.removed.map((code, offset) => diffLine('-', code, offset)),
    ...change.added.map((code, offset) => diffLine('+', code, offset)),
  ]
}

const bashStep: ToolStep = (rng) => {
  const run = rng.pick(COMMAND_RUNS)
  return [toolCall('Bash', run.command, rng.int(1200, 3000)), toolResult(run.output, rng)]
}

const webSearchStep: ToolStep = (rng) => [
  toolCall('Web Search', `"${rng.pick(SEARCH_QUERIES)}"`, rng.int(800, 2000)),
  toolResult(`Did 1 search in ${rng.int(1, 4)}s`, rng),
]

const webFetchStep: ToolStep = (rng) => [
  toolCall('Fetch', rng.pick(DOC_URLS), rng.int(800, 2000)),
  toolResult(`Received ${(rng.int(40, 900) / 10).toFixed(1)}KB (200 OK)`, rng),
]

const todoStep: ToolStep = (rng) => {
  const doneCount = rng.int(1, 3)
  const items = TODO_ITEMS.slice(0, doneCount + 2)
  return [
    toolCall('Update Todos', null, rng.int(250, 700)),
    ...items.map((item, index) =>
      line(
        [
          { text: index === 0 ? '  ⎿  ' : '     ', role: 'muted' },
          { text: `${index < doneCount ? '☒' : '☐'} ${item}`, role: index < doneCount ? 'muted' : 'result' },
        ],
        80,
      ),
    ),
  ]
}

// 읽기와 수정이 더 자주 나오도록 같은 단계를 두 번씩 넣는다.
const TOOL_STEPS: readonly ToolStep[] = [
  grepStep,
  globStep,
  readStep,
  readStep,
  updateStep,
  updateStep,
  bashStep,
  webSearchStep,
  webFetchStep,
  todoStep,
]

export function generateTask(rng: Rng, promptFor: PromptForProject): FakeEvent[] {
  const project = rng.pick(PROJECTS)
  const events: FakeEvent[] = [
    line(
      [
        { text: promptFor(project), role: 'prompt' },
        { text: ' claude', role: 'userInput' },
      ],
      700,
    ),
    blankLine(300),
    { kind: 'typeOut', text: `> ${rng.pick(REQUESTS)}`, role: 'userInput', charDelayMs: rng.int(25, 60) },
    { kind: 'spinner', label: rng.pick(SPINNER_LABELS), durationMs: rng.int(1500, 6000) },
  ]

  const toolCallCount = rng.int(TOOL_CALLS_PER_TASK.min, TOOL_CALLS_PER_TASK.max)
  for (let i = 0; i < toolCallCount; i++) {
    events.push(...rng.pick(TOOL_STEPS)(rng))
    if (rng.chance(0.3)) {
      events.push({ kind: 'spinner', label: rng.pick(SPINNER_LABELS), durationMs: rng.int(1000, 4000) })
    }
  }

  events.push(
    blankLine(200),
    line(
      [
        { text: '✓ ', role: 'success' },
        { text: rng.pick(SUMMARIES), role: 'success' },
      ],
      1500,
    ),
    blankLine(2500),
  )
  return events
}

export function createSessionStream(seed: number, promptFor: PromptForProject): () => FakeEvent {
  const rng = createRng(seed)
  let pending: FakeEvent[] = []
  return () => {
    if (pending.length === 0) pending = generateTask(rng, promptFor)
    return pending.shift()!
  }
}
