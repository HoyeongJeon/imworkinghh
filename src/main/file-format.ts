import { extname } from 'node:path'
import type { FileFormat } from '../shared/types'

export type DialogFilter = { name: string; extensions: string[] }

const FORMAT_BY_EXTENSION: Record<string, FileFormat> = {
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
}

const SAVE_FILTER_BY_FORMAT: Record<FileFormat, DialogFilter> = {
  md: { name: 'Markdown (*.md)', extensions: ['md'] },
  txt: { name: 'Text (*.txt)', extensions: ['txt'] },
}

export const OPEN_DIALOG_FILTERS: DialogFilter[] = [
  { name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
]

export function formatFromPath(filePath: string): FileFormat | null {
  return FORMAT_BY_EXTENSION[extname(filePath).toLowerCase()] ?? null
}

export function ensureExtension(filePath: string, format: FileFormat): string {
  return formatFromPath(filePath) ? filePath : `${filePath}.${format}`
}

export function saveDialogFilters(preferred: FileFormat): DialogFilter[] {
  const other: FileFormat = preferred === 'md' ? 'txt' : 'md'
  return [SAVE_FILTER_BY_FORMAT[preferred], SAVE_FILTER_BY_FORMAT[other]]
}
