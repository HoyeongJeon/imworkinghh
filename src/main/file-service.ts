import { dirname, join } from 'node:path'
import type { OpenResult, SaveRequest, SaveResult } from '../shared/api'
import { defaultEol } from '../shared/eol'
import type { FileFormat } from '../shared/types'
import {
  readDocument,
  writeDocument,
  type ReadDocumentResult,
  type WriteDocumentRequest,
  type WriteDocumentResult,
} from './documents'
import { ensureExtension, formatFromPath } from './file-format'

export type FileDialogs = {
  pickOpenPath(defaultDirectory: string | null): Promise<string | null>
  pickSavePath(suggestedPath: string, preferredFormat: FileFormat): Promise<string | null>
  confirmLargeFile(bytes: number): Promise<boolean>
  showError(title: string, message: string): Promise<void>
}

export type FileServiceDeps = {
  dialogs: FileDialogs
  platform: string
  read?: (path: string, options?: { maxBytes?: number }) => Promise<ReadDocumentResult>
  write?: (request: WriteDocumentRequest) => Promise<WriteDocumentResult>
}

export type FileService = {
  openWithDialog(defaultDirectory: string | null): Promise<OpenResult>
  openPath(path: string): Promise<OpenResult>
  save(request: SaveRequest): Promise<SaveResult>
}

export function createFileService({
  dialogs,
  platform,
  read = readDocument,
  write = (request) => writeDocument(request),
}: FileServiceDeps): FileService {
  async function readWithSizeCheck(path: string): Promise<ReadDocumentResult | null> {
    const result = await read(path)
    if (result.status !== 'tooLarge') return result
    if (!(await dialogs.confirmLargeFile(result.bytes))) return null
    return read(path, { maxBytes: Infinity })
  }

  async function openFromPath(path: string, showErrors: boolean): Promise<OpenResult> {
    const result = await readWithSizeCheck(path)
    if (result === null) return { status: 'canceled' }
    if (result.status === 'ok') {
      return {
        status: 'opened',
        file: {
          path,
          directory: dirname(path),
          text: result.text,
          eol: result.eol ?? defaultEol(platform),
          encoding: result.encoding,
          format: formatFromPath(path) ?? 'txt',
        },
      }
    }
    const message = result.status === 'failed' ? result.message : '파일이 너무 커서 열 수 없습니다.'
    if (showErrors) await dialogs.showError('파일을 열지 못했습니다', message)
    return { status: 'failed', message }
  }

  return {
    async openWithDialog(defaultDirectory) {
      const path = await dialogs.pickOpenPath(defaultDirectory)
      return path ? openFromPath(path, true) : { status: 'canceled' }
    },

    openPath(path) {
      return openFromPath(path, false)
    },

    async save(request) {
      const needsDialog = request.saveAs || request.path === null
      const chosenPath = needsDialog
        ? await dialogs.pickSavePath(suggestedSavePath(request), request.defaultFormat)
        : request.path
      if (!chosenPath) return { status: 'canceled' }

      const path = ensureExtension(chosenPath, request.defaultFormat)
      const result = await write({ path, text: request.text, eol: request.eol })
      if (result.status === 'failed') {
        await dialogs.showError('저장하지 못했습니다', result.message)
        return result
      }
      return { status: 'saved', path, directory: dirname(path), format: formatFromPath(path) ?? request.defaultFormat }
    },
  }
}

function suggestedSavePath(request: SaveRequest): string {
  if (request.path) return request.path
  const fileName = `untitled.${request.defaultFormat}`
  return request.defaultDirectory ? join(request.defaultDirectory, fileName) : fileName
}
