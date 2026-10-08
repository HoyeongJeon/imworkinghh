// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createSettingsDialog } from '../../src/renderer/settings-dialog'
import { defaultSettings } from '../../src/shared/settings'
import type { Settings } from '../../src/shared/types'

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const changes: Settings[] = []
  const dialog = createSettingsDialog({
    host,
    platform: 'win32',
    themes: [
      { id: 'windows-terminal', name: 'Windows Terminal' },
      { id: 'cmd', name: 'CMD' },
      { id: 'wsl-ubuntu', name: 'WSL Ubuntu' },
    ],
    onChange: (next) => changes.push(next),
  })
  const field = <T extends HTMLElement>(name: keyof Settings) => host.querySelector<T>(`[name="${name}"]`)!
  return { host, dialog, changes, field }
}

describe('설정 창', () => {
  it('열면 현재 설정 값을 보여 준다', () => {
    const { dialog, field } = setup()
    dialog.open({ ...defaultSettings('win32'), theme: 'wsl-ubuntu', typingLink: false })
    expect(field<HTMLSelectElement>('theme').value).toBe('wsl-ubuntu')
    expect(field<HTMLInputElement>('typingLink').checked).toBe(false)
    expect(field<HTMLInputElement>('panicKey').value).toBe('Ctrl+`')
  })

  it('테마를 바꾸면 바뀐 설정을 알린다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const select = field<HTMLSelectElement>('theme')
    select.value = 'cmd'
    select.dispatchEvent(new Event('change'))
    expect(changes.at(-1)?.theme).toBe('cmd')
  })

  it('옵션을 끄면 꺼진 설정을 알린다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const checkbox = field<HTMLInputElement>('panicEnabled')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    expect(changes.at(-1)?.panicEnabled).toBe(false)
  })

  it('잇따라 바꾼 설정은 앞서 바꾼 값을 유지한다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const select = field<HTMLSelectElement>('logSpeed')
    select.value = 'fast'
    select.dispatchEvent(new Event('change'))
    const checkbox = field<HTMLInputElement>('syntaxHighlight')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    expect(changes.at(-1)).toMatchObject({ logSpeed: 'fast', syntaxHighlight: false })
  })

  it('잘못된 패닉 키 조합은 받아들이지 않고 표시한다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('panicKey')
    input.value = 'Ctrl+Foo'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('change'))
    expect(changes).toHaveLength(0)
    expect(input.classList.contains('invalid')).toBe(true)
  })

  it('보조키 없는 키는 패닉 키로 받아들이지 않는다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('panicKey')
    input.value = 'm'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('change'))
    expect(changes).toHaveLength(0)
    expect(input.classList.contains('invalid')).toBe(true)
  })

  it('패닉 키는 입력하는 동안에는 반영하지 않고 입력을 마치면 반영한다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('panicKey')
    input.value = 'Ctrl+Shift+K'
    input.dispatchEvent(new Event('input'))
    expect(changes).toHaveLength(0)
    input.dispatchEvent(new Event('change'))
    expect(changes.at(-1)?.panicKey).toBe('Ctrl+Shift+K')
  })

  it('허용 범위를 벗어난 글꼴 크기는 받아들이지 않는다', () => {
    const { dialog, field, changes } = setup()
    dialog.open(defaultSettings('win32'))
    const input = field<HTMLInputElement>('fontSize')
    input.value = '99'
    input.dispatchEvent(new Event('change'))
    expect(changes).toHaveLength(0)
  })

  it('Esc를 누르면 닫힌다', () => {
    const { host, dialog } = setup()
    dialog.open(defaultSettings('win32'))
    host.querySelector('.settings-panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dialog.isOpen()).toBe(false)
    expect(host.querySelector('.settings-overlay')).toBeNull()
  })
})
