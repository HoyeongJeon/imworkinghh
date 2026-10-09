import { FILE_FORMATS, LOG_SPEEDS, THEME_IDS, type Settings, type WindowBounds } from './types'
import { MAX_PANES, isSamePath } from './panes'

export const FONT_SIZE_RANGE = { min: 10, max: 32 }
export const SPLIT_RATIO_RANGE = { min: 0.1, max: 0.9 }

export function defaultSettings(platform: string): Settings {
  const isMac = platform === 'darwin'
  return {
    stealthMode: true,
    theme: isMac ? 'macos-basic' : 'windows-terminal',
    syntaxHighlight: true,
    panicEnabled: true,
    panicKey: isMac ? 'Mod+Shift+.' : 'Mod+`',
    typingLink: true,
    logSpeed: 'normal',
    fontSize: 14,
    splitRatio: 0.55,
    windowBounds: null,
    lastDirectory: null,
    openFiles: [],
    paneWidths: [],
    defaultFormat: 'md',
  }
}

export function normalizeSettings(raw: unknown, platform: string): Settings {
  const defaults = defaultSettings(platform)
  if (!isRecord(raw)) return defaults
  return {
    stealthMode: pickBoolean(raw.stealthMode, defaults.stealthMode),
    theme: pickOneOf(raw.theme, THEME_IDS, defaults.theme),
    syntaxHighlight: pickBoolean(raw.syntaxHighlight, defaults.syntaxHighlight),
    panicEnabled: pickBoolean(raw.panicEnabled, defaults.panicEnabled),
    panicKey: pickNonEmptyString(raw.panicKey) ?? defaults.panicKey,
    typingLink: pickBoolean(raw.typingLink, defaults.typingLink),
    logSpeed: pickOneOf(raw.logSpeed, LOG_SPEEDS, defaults.logSpeed),
    fontSize: pickNumberInRange(raw.fontSize, FONT_SIZE_RANGE, defaults.fontSize),
    splitRatio: pickNumberInRange(raw.splitRatio, SPLIT_RATIO_RANGE, defaults.splitRatio),
    windowBounds: pickWindowBounds(raw.windowBounds),
    lastDirectory: pickNonEmptyString(raw.lastDirectory),
    openFiles: pickOpenFiles(raw.openFiles, raw.lastFile),
    paneWidths: pickPaneWidths(raw.paneWidths),
    defaultFormat: pickOneOf(raw.defaultFormat, FILE_FORMATS, defaults.defaultFormat),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pickOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function pickNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function pickNumberInRange(
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(range.max, Math.max(range.min, value))
}

function pickWindowBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  const numbers = [x, y, width, height]
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  const bounds = { x, y, width, height } as WindowBounds
  return bounds.width > 0 && bounds.height > 0 ? bounds : null
}

// 나란히 쓰기 이전 버전은 마지막 파일 하나만 lastFile에 저장했다.
function pickOpenFiles(value: unknown, legacyLastFile: unknown): string[] {
  if (!Array.isArray(value)) {
    const lastFile = pickNonEmptyString(legacyLastFile)
    return lastFile ? [lastFile] : []
  }
  const files: string[] = []
  for (const item of value) {
    const path = pickNonEmptyString(item)
    if (path && !files.some((file) => isSamePath(file, path))) files.push(path)
  }
  return files.slice(0, MAX_PANES)
}

const WIDTH_SUM_TOLERANCE = 0.001

function pickPaneWidths(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return []
  const widths = value.filter((width): width is number => typeof width === 'number' && Number.isFinite(width) && width > 0)
  if (widths.length !== value.length) return []
  const sum = widths.reduce((total, width) => total + width, 0)
  return Math.abs(sum - 1) <= WIDTH_SUM_TOLERANCE ? widths : []
}
