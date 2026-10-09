export const MAX_PANES = 2

// Windows와 macOS의 기본 파일 시스템은 대소문자를 구분하지 않는다.
export function isSamePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}
