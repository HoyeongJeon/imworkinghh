import { describe, expect, it } from 'vitest'
import { MAX_PANES, isSamePath } from '../../src/shared/panes'

describe('칸 공용 규칙', () => {
  it('최대 칸 수는 2칸이다', () => {
    expect(MAX_PANES).toBe(2)
  })

  it('대소문자만 다른 경로는 같은 파일로 본다', () => {
    expect(isSamePath('C:\\Notes\\A.md', 'c:\\notes\\a.md')).toBe(true)
    expect(isSamePath('/Users/me/Todo.md', '/users/me/todo.md')).toBe(true)
  })

  it('한글 파일 이름이 자모로 풀려 있어도 같은 파일로 본다', () => {
    const composed = '/Users/me/회의록.md'.normalize('NFC')
    const decomposed = '/Users/me/회의록.md'.normalize('NFD')
    expect(composed).not.toBe(decomposed)
    expect(isSamePath(composed, decomposed)).toBe(true)
  })

  it('다른 경로는 다른 파일로 본다', () => {
    expect(isSamePath('C:\\notes\\a.md', 'C:\\notes\\b.md')).toBe(false)
  })
})
