export type LogRole =
  | 'prompt'
  | 'userInput'
  | 'toolBullet'
  | 'toolName'
  | 'toolArg'
  | 'result'
  | 'diffAdd'
  | 'diffRemove'
  | 'thinking'
  | 'success'
  | 'muted'

export type LogSegment = { text: string; role: LogRole }

export type FakeEvent =
  | { kind: 'line'; segments: LogSegment[]; delayMs: number }
  | { kind: 'typeOut'; text: string; role: LogRole; charDelayMs: number }
  | { kind: 'spinner'; label: string; durationMs: number }

export type LogSink = {
  appendLine(segments: LogSegment[]): void
  replaceLastLine(segments: LogSegment[]): void
}
