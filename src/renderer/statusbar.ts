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

export function countCharacters(text: string): number {
  return [...text.replace(/\n/g, '')].length
}

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
