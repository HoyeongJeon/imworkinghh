const MESSAGE_BY_CODE: Record<string, string> = {
  EACCES: '권한이 없어 파일에 접근할 수 없습니다.',
  EPERM: '권한이 없어 파일에 접근할 수 없습니다.',
  EROFS: '읽기 전용 위치라 저장할 수 없습니다.',
  ENOSPC: '디스크 공간이 부족합니다.',
  ENOENT: '파일이나 폴더를 찾을 수 없습니다.',
  EBUSY: '다른 프로그램이 파일을 사용 중입니다.',
  EISDIR: '폴더는 열 수 없습니다.',
}

export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const { code } = error as { code: unknown }
  return typeof code === 'string' ? code : null
}

export function describeFsError(error: unknown): string {
  const code = errorCode(error)
  if (code && MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code]
  const detail = code ?? (error instanceof Error ? error.message : String(error))
  return `알 수 없는 오류가 발생했습니다. (${detail})`
}
