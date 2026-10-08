import { randomBytes } from 'node:crypto'
import { promises as nodeFs } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { errorCode } from './fs-errors'

export type AtomicWriteFs = {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  rename(from: string, to: string): Promise<void>
  rm(path: string, options: { force: boolean }): Promise<void>
}

export type AtomicWriteOptions = {
  fs?: AtomicWriteFs
  retries?: number
  retryDelayMs?: number
}

const defaultFs: AtomicWriteFs = {
  writeFile: (path, data) => nodeFs.writeFile(path, data),
  rename: (from, to) => nodeFs.rename(from, to),
  rm: (path, options) => nodeFs.rm(path, options),
}

// Windows에서는 백신이나 검색 색인이 파일을 잠깐 잡고 있으면 교체가 이 코드들로 실패한다.
const LOCKED_FILE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

export async function writeFileAtomic(
  targetPath: string,
  data: string | Uint8Array,
  { fs = defaultFs, retries = 5, retryDelayMs = 50 }: AtomicWriteOptions = {},
): Promise<void> {
  const tempPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${randomBytes(4).toString('hex')}.tmp`,
  )
  try {
    await fs.writeFile(tempPath, data)
    await renameWithRetry(fs, tempPath, targetPath, retries, retryDelayMs)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function renameWithRetry(
  fs: AtomicWriteFs,
  from: string,
  to: string,
  retries: number,
  retryDelayMs: number,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const code = errorCode(error)
      const canRetry = code !== null && LOCKED_FILE_CODES.has(code) && attempt < retries
      if (!canRetry) throw error
      await sleep(retryDelayMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
