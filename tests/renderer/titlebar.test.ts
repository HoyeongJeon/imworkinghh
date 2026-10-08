// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTitlebar, type WindowActions } from '../../src/renderer/titlebar'

function setup(platform: string) {
  const element = document.createElement('header')
  const calls: string[] = []
  const actions: WindowActions = {
    minimize: () => calls.push('minimize'),
    toggleMaximize: () => calls.push('toggleMaximize'),
    close: () => calls.push('close'),
  }
  return { element, calls, titlebar: createTitlebar(element, { platform, actions }) }
}

describe('가짜 터미널 제목줄', () => {
  it('윈도우 테마는 탭 모양 제목과 창 버튼 세 개를 그린다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    expect(element.querySelector('.tb-tab-title')?.textContent).toBe('Windows PowerShell')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(3)
  })

  it('맥 테마는 가운데 제목을 그린다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelector('.tb-mac-title')?.textContent).toBe('user — claude — 120×40')
  })

  it('맥에서는 기본 신호등 버튼을 쓰므로 창 버튼을 그리지 않는다', () => {
    const { element, titlebar } = setup('darwin')
    titlebar.render('windows', 'Windows PowerShell')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(0)
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelectorAll('[data-action]')).toHaveLength(0)
  })

  it('창 버튼을 누르면 해당 동작을 실행한다', () => {
    const { element, titlebar, calls } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    element.querySelector<HTMLButtonElement>('[data-action="close"]')!.click()
    element.querySelector<HTMLButtonElement>('[data-action="minimize"]')!.click()
    expect(calls).toEqual(['close', 'minimize'])
  })

  it('테마를 바꿔 다시 그리면 이전 제목줄을 지운다', () => {
    const { element, titlebar } = setup('win32')
    titlebar.render('windows', 'Windows PowerShell')
    titlebar.render('mac', 'user — claude — 120×40')
    expect(element.querySelector('.tb-tab')).toBeNull()
  })
})
