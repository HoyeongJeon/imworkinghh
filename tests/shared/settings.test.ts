import { describe, expect, it } from 'vitest'
import { defaultSettings, normalizeSettings } from '../../src/shared/settings'

describe('설정 기본값', () => {
  it('윈도우에서는 Windows Terminal 테마와 Ctrl+` 패닉 키로 시작한다', () => {
    const settings = defaultSettings('win32')
    expect(settings.theme).toBe('windows-terminal')
    expect(settings.panicKey).toBe('Mod+`')
  })

  it('맥에서는 macOS Basic 테마와 Cmd+Shift+. 패닉 키로 시작한다', () => {
    const settings = defaultSettings('darwin')
    expect(settings.theme).toBe('macos-basic')
    expect(settings.panicKey).toBe('Mod+Shift+.')
  })

  it('문법 색칠, 패닉 키, 타이핑 연동은 켜진 상태로 시작한다', () => {
    const settings = defaultSettings('win32')
    expect(settings.syntaxHighlight).toBe(true)
    expect(settings.panicEnabled).toBe(true)
    expect(settings.typingLink).toBe(true)
  })
})

describe('은신 모드 설정', () => {
  it('은신 모드는 켜진 상태로 시작한다', () => {
    expect(defaultSettings('win32').stealthMode).toBe(true)
  })

  it('은신 모드를 끈 설정은 다시 읽어도 꺼져 있다', () => {
    expect(normalizeSettings({ stealthMode: false }, 'win32').stealthMode).toBe(false)
  })

  it('은신 모드 값이 참/거짓이 아니면 켜진 상태로 본다', () => {
    expect(normalizeSettings({ stealthMode: 'off' }, 'win32').stealthMode).toBe(true)
  })
})

describe('설정 교정', () => {
  it('저장된 값이 없으면 기본값을 쓴다', () => {
    expect(normalizeSettings(undefined, 'win32')).toEqual(defaultSettings('win32'))
  })

  it('올바른 값은 그대로 유지한다', () => {
    const saved = {
      ...defaultSettings('win32'),
      theme: 'wsl-ubuntu',
      logSpeed: 'fast',
      lastFile: 'C:\\notes\\회의록.md',
      windowBounds: { x: 10, y: 20, width: 800, height: 600 },
    }
    expect(normalizeSettings(saved, 'win32')).toEqual(saved)
  })

  it('알 수 없는 항목은 버린다', () => {
    expect(normalizeSettings({ unknownOption: 1 }, 'win32')).not.toHaveProperty('unknownOption')
  })

  it('타입이 틀린 값은 기본값으로 바꾼다', () => {
    const result = normalizeSettings(
      { syntaxHighlight: 'yes', fontSize: '20', windowBounds: { x: 0 } },
      'win32',
    )
    expect(result.syntaxHighlight).toBe(true)
    expect(result.fontSize).toBe(14)
    expect(result.windowBounds).toBeNull()
  })

  it('글꼴 크기와 분할 비율은 허용 범위 안으로 맞춘다', () => {
    const result = normalizeSettings({ fontSize: 99, splitRatio: -1 }, 'win32')
    expect(result.fontSize).toBe(32)
    expect(result.splitRatio).toBe(0.1)
  })

  it('없는 테마 이름이면 기본 테마로 바꾼다', () => {
    expect(normalizeSettings({ theme: 'solarized' }, 'darwin').theme).toBe('macos-basic')
  })
})
