// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  APP_SHORTCUTS,
  bindShortcuts,
  displayShortcut,
  isUsableAppShortcut,
  matchesShortcut,
  parseShortcut,
  type KeyPress,
} from '../../src/renderer/shortcuts'

const press = (overrides: Partial<KeyPress>): KeyPress => ({
  code: 'KeyS',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  keyCode: 83,
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

  it('조합 시작 신호(keyCode 229)가 오면 isComposing이 꺼져 있어도 반응하지 않는다', () => {
    expect(matchesShortcut(press({ ctrlKey: true, keyCode: 229 }), 'Mod+S', 'win32')).toBe(false)
  })

  it('은신 모드는 Mod+Shift+M으로 켜고 끈다', () => {
    expect(APP_SHORTCUTS.toggleStealthMode).toBe('Mod+Shift+M')
  })

  it('칸은 Ctrl+\\로 더하고 Ctrl+W로 닫고 Ctrl+Tab으로 옮긴다', () => {
    expect(matchesShortcut(press({ code: 'Backslash', ctrlKey: true }), APP_SHORTCUTS.addPane, 'win32')).toBe(true)
    expect(matchesShortcut(press({ code: 'KeyW', ctrlKey: true }), APP_SHORTCUTS.closePane, 'win32')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', ctrlKey: true }), APP_SHORTCUTS.nextPane, 'win32')).toBe(true)
  })

  it('맥에서 칸 더하기와 닫기는 Cmd를 쓰지만 칸 이동은 앱 전환 키를 피해 Ctrl+Tab이다', () => {
    expect(matchesShortcut(press({ code: 'Backslash', metaKey: true }), APP_SHORTCUTS.addPane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'KeyW', metaKey: true }), APP_SHORTCUTS.closePane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', ctrlKey: true }), APP_SHORTCUTS.nextPane, 'darwin')).toBe(true)
    expect(matchesShortcut(press({ code: 'Tab', metaKey: true }), APP_SHORTCUTS.nextPane, 'darwin')).toBe(false)
  })

  it('Tab 키도 단축키 조합에 쓸 수 있다', () => {
    expect(parseShortcut('Ctrl+Tab')).toEqual({ code: 'Tab', mod: false, ctrl: true, cmd: false, shift: false, alt: false })
  })

  it('앱 단축키와 기본 패닉 키는 서로 겹치지 않는다', () => {
    const combos = [...Object.values(APP_SHORTCUTS), 'Mod+`', 'Mod+Shift+.']
    expect(new Set(combos).size).toBe(combos.length)
  })

  it('알 수 없는 키나 보조키 이름은 조합으로 인정하지 않는다', () => {
    expect(parseShortcut('Mod+Foo')).toBeNull()
    expect(parseShortcut('Hyper+S')).toBeNull()
    expect(parseShortcut('')).toBeNull()
  })

  it('글을 쓰다 실수로 누르지 않도록 Ctrl, Cmd, Alt 중 하나가 있어야 단축키로 쓸 수 있다', () => {
    expect(isUsableAppShortcut('Ctrl+`')).toBe(true)
    expect(isUsableAppShortcut('Mod+Shift+.')).toBe(true)
    expect(isUsableAppShortcut('m')).toBe(false)
    expect(isUsableAppShortcut('Shift+M')).toBe(false)
    expect(isUsableAppShortcut('Ctrl+Foo')).toBe(false)
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
