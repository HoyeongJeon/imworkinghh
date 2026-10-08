import { describe, expect, it } from 'vitest'
import { ensureExtension, formatFromPath, saveDialogFilters } from '../../src/main/file-format'

describe('파일 저장 형식', () => {
  it('확장자 없이 저장하면 고른 형식의 확장자를 붙인다', () => {
    expect(ensureExtension('/notes/회의록', 'md')).toBe('/notes/회의록.md')
    expect(ensureExtension('/notes/회의록', 'txt')).toBe('/notes/회의록.txt')
  })

  it('이미 .md나 .txt로 끝나면 확장자를 덧붙이지 않는다', () => {
    expect(ensureExtension('/notes/a.md', 'txt')).toBe('/notes/a.md')
    expect(ensureExtension('/notes/a.txt', 'md')).toBe('/notes/a.txt')
  })

  it('확장자는 대소문자를 가리지 않는다', () => {
    expect(ensureExtension('/notes/README.MD', 'txt')).toBe('/notes/README.MD')
  })

  it('모르는 확장자면 고른 형식의 확장자를 뒤에 붙인다', () => {
    expect(ensureExtension('/notes/v1.2', 'md')).toBe('/notes/v1.2.md')
  })

  it('경로의 확장자로 형식을 알아낸다', () => {
    expect(formatFromPath('/notes/a.markdown')).toBe('md')
    expect(formatFromPath('/notes/a.TXT')).toBe('txt')
    expect(formatFromPath('/notes/a.log')).toBeNull()
  })

  it('저장 창은 마지막에 고른 형식을 먼저 보여 준다', () => {
    expect(saveDialogFilters('txt').map((f) => f.extensions[0])).toEqual(['txt', 'md'])
    expect(saveDialogFilters('md').map((f) => f.extensions[0])).toEqual(['md', 'txt'])
  })
})
