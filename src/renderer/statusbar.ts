import type { SourceEncoding } from '../shared/types'

export type StatusInfo = {
  fileName: string | null
  dirty: boolean
  line: number
  column: number
  characters: number
  encoding: SourceEncoding
  logPaused: boolean
}

export const UNTITLED_NAME = 'untitled'

const ENCODING_LABELS: Record<SourceEncoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 BOM → UTF-8',
  'utf-16le': 'UTF-16 LE → UTF-8',
  'utf-16be': 'UTF-16 BE → UTF-8',
  cp949: 'CP949 → UTF-8',
}

export function describeEncoding(encoding: SourceEncoding): string {
  return ENCODING_LABELS[encoding]
}

const NEWLINE = 0x0a

// 큰 글을 배열로 펼치면 글자 수만큼 메모리를 쓰므로, 펼치지 않고 코드 포인트 단위로 센다.
export function countCharacters(text: string): number {
  let count = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code === NEWLINE) continue
    if (isLowSurrogate(code) && index > 0 && isHighSurrogate(text.charCodeAt(index - 1))) continue
    count++
  }
  return count
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

export function formatStatus(info: StatusInfo): { left: string; right: string } {
  const left = `${info.fileName ?? UNTITLED_NAME}${info.dirty ? ' ●' : ''}`
  const parts = [
    `Ln ${info.line}, Col ${info.column}`,
    `${info.characters.toLocaleString('en-US')}자`,
    describeEncoding(info.encoding),
  ]
  if (info.logPaused) parts.push('⏸ paused')
  return { left, right: parts.join('  ·  ') }
}

export function createStatusbar(element: HTMLElement): { update(info: StatusInfo): void } {
  const doc = element.ownerDocument
  const left = doc.createElement('span')
  left.className = 'status-left'
  const right = doc.createElement('span')
  right.className = 'status-right'
  element.replaceChildren(left, right)
  return {
    update(info) {
      const text = formatStatus(info)
      left.textContent = text.left
      right.textContent = text.right
    },
  }
}
