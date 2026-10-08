// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { countCharacters, createStatusbar, formatStatus, type StatusInfo } from '../../src/renderer/statusbar'

const status = (overrides: Partial<StatusInfo> = {}): StatusInfo => ({
  fileName: 'notes.md',
  dirty: false,
  line: 3,
  column: 1,
  characters: 128,
  encoding: 'utf-8',
  logPaused: false,
  ...overrides,
})

describe('상태바', () => {
  it('파일 이름과 저장 안 한 변경 표시를 보여 준다', () => {
    expect(formatStatus(status({ dirty: true })).left).toBe('notes.md ●')
    expect(formatStatus(status({ dirty: false })).left).toBe('notes.md')
  })

  it('새 문서는 untitled로 보여 준다', () => {
    expect(formatStatus(status({ fileName: null })).left).toBe('untitled')
  })

  it('줄, 칸, 글자수, 인코딩을 보여 준다', () => {
    expect(formatStatus(status({ characters: 1234 })).right).toBe('Ln 3, Col 1  ·  1,234자  ·  UTF-8')
  })

  it('UTF-8이 아닌 파일은 저장하면 UTF-8로 바뀐다는 것을 보여 준다', () => {
    expect(formatStatus(status({ encoding: 'cp949' })).right).toContain('CP949 → UTF-8')
  })

  it('가짜 세션이 멈춰 있으면 멈춤 표시를 보여 준다', () => {
    expect(formatStatus(status({ logPaused: true })).right).toContain('⏸ paused')
  })

  it('글자수는 줄바꿈을 세지 않고 이모지는 한 글자로 센다', () => {
    expect(countCharacters('가나\n다😀')).toBe(4)
  })

  it('짝이 맞지 않는 서로게이트 문자도 하나씩 한 글자로 센다', () => {
    expect(countCharacters('\ud83d가\ude00')).toBe(3)
  })

  it('상태 정보를 받으면 상태바 양쪽 글자를 바꾼다', () => {
    const element = document.createElement('footer')
    createStatusbar(element).update(status({ dirty: true }))
    expect(element.querySelector('.status-left')?.textContent).toBe('notes.md ●')
    expect(element.querySelector('.status-right')?.textContent).toContain('Ln 3, Col 1')
  })
})
