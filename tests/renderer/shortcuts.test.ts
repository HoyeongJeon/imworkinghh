// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { bindShortcuts, displayShortcut, matchesShortcut, parseShortcut, type KeyPress } from '../../src/renderer/shortcuts'

const press = (overrides: Partial<KeyPress>): KeyPress => ({
  code: 'KeyS',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...overrides,
})

describe('단축키', () => {
  it('윈도우에서 Mod는 Ctrl로 동작한다', () => {
    expect(matchesShortcut(press({ ctrlKey: true }), 'Mod+S', 'win32')).toBe(true)
    expect(matchesShortcut(press({ metaKey: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('맥에서 Mod는 Cmd로 동작한다', () => {
    expect(matchesShortcut(press({ metaKey: true }), 'Mod+S', 'darwin')).toBe(true)
    expect(matchesShortcut(press({ ctrlKey: true }), 'Mod+S', 'darwin')).toBe(false)
  })

  it('조합에 없는 보조키가 눌려 있으면 반응하지 않는다', () => {
    expect(matchesShortcut(press({ ctrlKey: true, shiftKey: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('Shift+.은 키보드 배열과 상관없이 마침표 키로 인식한다', () => {
    expect(matchesShortcut(press({ code: 'Period', metaKey: true, shiftKey: true }), 'Mod+Shift+.', 'darwin')).toBe(true)
  })

  it('Ctrl+`는 백틱 키로 인식한다', () => {
    expect(matchesShortcut(press({ code: 'Backquote', ctrlKey: true }), 'Mod+`', 'win32')).toBe(true)
  })

  it('한글 조합 중에는 단축키가 반응하지 않는다', () => {
    expect(matchesShortcut(press({ ctrlKey: true, isComposing: true }), 'Mod+S', 'win32')).toBe(false)
  })

  it('알 수 없는 키나 보조키 이름은 조합으로 인정하지 않는다', () => {
    expect(parseShortcut('Mod+Foo')).toBeNull()
    expect(parseShortcut('Hyper+S')).toBeNull()
    expect(parseShortcut('')).toBeNull()
  })

  it('화면에 보여 줄 때 Mod를 OS에 맞는 키 이름으로 바꾼다', () => {
    expect(displayShortcut('Mod+Shift+.', 'darwin')).toBe('Cmd+Shift+.')
    expect(displayShortcut('Mod+`', 'win32')).toBe('Ctrl+`')
  })

  it('등록한 단축키를 누르면 동작을 실행하고 기본 동작을 막는다', () => {
    let saved = 0
    const unbind = bindShortcuts(window, [{ combo: () => 'Mod+S', run: () => saved++ }], 'win32')
    const event = new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(saved).toBe(1)
    expect(event.defaultPrevented).toBe(true)
    unbind()
  })

  it('조합이 꺼져 있으면 단축키가 반응하지 않는다', () => {
    let panicked = 0
    const unbind = bindShortcuts(window, [{ combo: () => null, run: () => panicked++ }], 'win32')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', ctrlKey: true }))
    expect(panicked).toBe(0)
    unbind()
  })
})
