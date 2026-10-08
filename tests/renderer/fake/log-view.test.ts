// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createLogView } from '../../../src/renderer/fake/log-view'

function fakeScrollBox(element: HTMLElement, box: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => box.scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => box.clientHeight })
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: box.scrollTop })
}

describe('가짜 세션 화면', () => {
  it('줄을 추가하면 역할별 색 클래스로 표시한다', () => {
    const container = document.createElement('div')
    createLogView(container).appendLine([
      { text: '● ', role: 'toolBullet' },
      { text: 'Read', role: 'toolName' },
    ])
    const spans = container.querySelectorAll('.log-line span')
    expect([...spans].map((span) => span.className)).toEqual(['role-toolBullet', 'role-toolName'])
    expect(container.textContent).toBe('● Read')
  })

  it('마지막 줄을 고쳐 쓰면 줄 수는 그대로이고 내용만 바뀐다', () => {
    const container = document.createElement('div')
    const view = createLogView(container)
    view.appendLine([{ text: '✢ Thinking… (0s)', role: 'thinking' }])
    view.replaceLastLine([{ text: '✳ Thinking… (1s)', role: 'thinking' }])
    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('✳ Thinking… (1s)')
  })

  it('최대 줄 수를 넘으면 오래된 줄부터 지운다', () => {
    const container = document.createElement('div')
    const view = createLogView(container, { maxLines: 3 })
    for (const text of ['1', '2', '3', '4', '5']) view.appendLine([{ text, role: 'result' }])
    expect([...container.children].map((line) => line.textContent)).toEqual(['3', '4', '5'])
  })

  it('맨 아래를 보고 있으면 새 줄이 올 때 따라 내려간다', () => {
    const container = document.createElement('div')
    fakeScrollBox(container, { scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    createLogView(container).appendLine([{ text: 'new', role: 'result' }])
    expect(container.scrollTop).toBe(1000)
  })

  it('위로 스크롤해서 보고 있으면 새 줄이 와도 스크롤을 옮기지 않는다', () => {
    const container = document.createElement('div')
    fakeScrollBox(container, { scrollHeight: 1000, clientHeight: 200, scrollTop: 100 })
    createLogView(container).appendLine([{ text: 'new', role: 'result' }])
    expect(container.scrollTop).toBe(100)
  })
})
