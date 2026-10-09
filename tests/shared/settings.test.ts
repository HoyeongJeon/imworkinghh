import { describe, expect, it } from 'vitest'
import { defaultSettings, normalizeSettings } from '../../src/shared/settings'
import { MAX_PANES } from '../../src/shared/panes'

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
      openFiles: ['C:\\notes\\회의록.md'],
      paneWidths: [0.4, 0.6],
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

describe('열린 파일 목록 설정', () => {
  it('처음에는 열린 파일이 없다', () => {
    expect(defaultSettings('win32').openFiles).toEqual([])
  })

  it('예전 설정의 마지막 파일은 열린 파일 목록으로 옮긴다', () => {
    const result = normalizeSettings({ lastFile: 'C:\\notes\\a.md' }, 'win32')
    expect(result.openFiles).toEqual(['C:\\notes\\a.md'])
    expect(result).not.toHaveProperty('lastFile')
  })

  it('열린 파일 목록이 있으면 예전 마지막 파일은 쓰지 않는다', () => {
    const result = normalizeSettings({ openFiles: ['C:\\notes\\b.md'], lastFile: 'C:\\notes\\a.md' }, 'win32')
    expect(result.openFiles).toEqual(['C:\\notes\\b.md'])
  })

  it('중복 경로와 문자열이 아닌 값은 버리고 최대 칸 수까지만 둔다', () => {
    const result = normalizeSettings(
      { openFiles: ['C:\\notes\\a.md', 'c:\\NOTES\\A.md', 3, '', 'C:\\notes\\b.md', 'C:\\notes\\c.md'] },
      'win32',
    )
    expect(result.openFiles).toEqual(['C:\\notes\\a.md', 'C:\\notes\\b.md', 'C:\\notes\\c.md'].slice(0, MAX_PANES))
  })
})

describe('칸 너비 설정', () => {
  it('처음에는 칸 너비가 정해져 있지 않다', () => {
    expect(defaultSettings('win32').paneWidths).toEqual([])
  })

  it('합이 1인 비율 목록은 그대로 둔다', () => {
    expect(normalizeSettings({ paneWidths: [0.3, 0.7] }, 'win32').paneWidths).toEqual([0.3, 0.7])
  })

  it('합이 1이 아니거나 양수가 아닌 값이 있으면 빈 목록으로 바꾼다', () => {
    expect(normalizeSettings({ paneWidths: [0.5, 0.6] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: [0.5, '0.5'] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: [0, 1] }, 'win32').paneWidths).toEqual([])
    expect(normalizeSettings({ paneWidths: 'wide' }, 'win32').paneWidths).toEqual([])
  })
})
