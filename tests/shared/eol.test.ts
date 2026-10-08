import { describe, expect, it } from 'vitest'
import { applyEol, defaultEol, detectEol, normalizeToLf } from '../../src/shared/eol'

describe('줄바꿈 처리', () => {
  it('CRLF로 쓴 글은 CRLF로 감지한다', () => {
    expect(detectEol('첫 줄\r\n둘째 줄\r\n')).toBe('crlf')
  })

  it('LF로 쓴 글은 LF로 감지한다', () => {
    expect(detectEol('첫 줄\n둘째 줄\n')).toBe('lf')
  })

  it('줄바꿈이 없으면 감지 결과가 없다', () => {
    expect(detectEol('한 줄짜리 메모')).toBeNull()
  })

  it('줄바꿈이 섞여 있으면 더 많이 쓰인 방식을 따른다', () => {
    expect(detectEol('a\r\nb\nc\n')).toBe('lf')
    expect(detectEol('a\r\nb\r\nc\n')).toBe('crlf')
  })

  it('편집용 글은 줄바꿈을 모두 LF로 바꾼다', () => {
    expect(normalizeToLf('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
  })

  it('CRLF로 저장할 때는 모든 줄바꿈을 CRLF로 바꾼다', () => {
    expect(applyEol('a\nb\r\nc', 'crlf')).toBe('a\r\nb\r\nc')
  })

  it('LF로 저장할 때는 모든 줄바꿈을 LF로 바꾼다', () => {
    expect(applyEol('a\r\nb\nc', 'lf')).toBe('a\nb\nc')
  })

  it('새 문서의 줄바꿈은 윈도우에서 CRLF, 맥에서 LF다', () => {
    expect(defaultEol('win32')).toBe('crlf')
    expect(defaultEol('darwin')).toBe('lf')
  })
})
