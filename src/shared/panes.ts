export const MAX_PANES = 2

// Windows와 macOS의 기본 파일 시스템은 대소문자를 구분하지 않고, macOS는 한글 파일 이름을 자모로 풀어(NFD) 줄 때가 있다.
export function isSamePath(a: string, b: string): boolean {
  const comparable = (path: string) => path.normalize('NFC').toLowerCase()
  return comparable(a) === comparable(b)
}
