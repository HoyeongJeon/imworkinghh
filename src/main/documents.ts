import { readFile, stat } from 'node:fs/promises'
import { applyEol, detectEol, normalizeToLf } from '../shared/eol'
import type { Eol, SourceEncoding } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { describeFsError } from './fs-errors'
import { decodeText, encodeUtf8 } from './text-codec'

export const LARGE_FILE_BYTES = 10 * 1024 * 1024

export type ReadDocumentResult =
  | { status: 'ok'; text: string; eol: Eol | null; encoding: SourceEncoding }
  | { status: 'tooLarge'; bytes: number }
  | { status: 'failed'; message: string }

export type WriteDocumentRequest = { path: string; text: string; eol: Eol }
export type WriteDocumentResult = { status: 'saved' } | { status: 'failed'; message: string }
export type WriteBytes = (path: string, data: Uint8Array) => Promise<void>

export async function readDocument(
  filePath: string,
  { maxBytes = LARGE_FILE_BYTES }: { maxBytes?: number } = {},
): Promise<ReadDocumentResult> {
  try {
    const { size } = await stat(filePath)
    if (size > maxBytes) return { status: 'tooLarge', bytes: size }
    const { text, encoding } = decodeText(await readFile(filePath))
    return { status: 'ok', text: normalizeToLf(text), eol: detectEol(text), encoding }
  } catch (error) {
    return { status: 'failed', message: describeFsError(error) }
  }
}

export async function writeDocument(
  request: WriteDocumentRequest,
  writeBytes: WriteBytes = writeFileAtomic,
): Promise<WriteDocumentResult> {
  try {
    await writeBytes(request.path, encodeUtf8(applyEol(request.text, request.eol)))
    return { status: 'saved' }
  } catch (error) {
    return { status: 'failed', message: describeFsError(error) }
  }
}
