import { describe, expect, it } from 'vitest'
import { filePathFromArgs } from '../../src/main/launch-args'

describe('실행 인자에서 열 파일 찾기', () => {
  it('탐색기에서 연 파일 경로를 찾는다', () => {
    expect(filePathFromArgs(['C:\\app\\imworkinghh.exe', 'C:\\notes\\a.md'])).toBe('C:\\notes\\a.md')
  })

  it('파일 없이 실행하면 열 파일이 없다', () => {
    expect(filePathFromArgs(['C:\\app\\imworkinghh.exe'])).toBeNull()
  })

  it('개발 모드의 앱 폴더 인자와 크로미움 옵션은 무시한다', () => {
    expect(filePathFromArgs(['electron.exe', '.', '--remote-debugging-port=9222', 'C:\\notes\\b.txt'])).toBe(
      'C:\\notes\\b.txt',
    )
    expect(filePathFromArgs(['electron.exe', '.', '--allow-file-access-from-files'])).toBeNull()
  })

  it('경로에 공백과 한글이 있어도 그대로 돌려준다', () => {
    expect(filePathFromArgs(['imworkinghh.exe', 'C:\\Users\\홍길동\\내 문서\\회의록 10월.md'])).toBe(
      'C:\\Users\\홍길동\\내 문서\\회의록 10월.md',
    )
  })
})
