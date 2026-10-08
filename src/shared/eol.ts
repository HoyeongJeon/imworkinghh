import type { Eol } from './types'

export function defaultEol(platform: string): Eol {
  return platform === 'win32' ? 'crlf' : 'lf'
}

export function detectEol(text: string): Eol | null {
  const crlfCount = text.match(/\r\n/g)?.length ?? 0
  const lfOnlyCount = text.match(/(?<!\r)\n/g)?.length ?? 0
  if (crlfCount === 0 && lfOnlyCount === 0) return null
  return crlfCount >= lfOnlyCount ? 'crlf' : 'lf'
}

export function normalizeToLf(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

export function applyEol(text: string, eol: Eol): string {
  const lfText = normalizeToLf(text)
  return eol === 'crlf' ? lfText.replace(/\n/g, '\r\n') : lfText
}
