import { describe, expect, it } from 'vitest'
import { createSessionHider, windowTitleFor } from '../../src/renderer/stealth'

describe('창 제목', () => {
  it('은신 모드에서는 테마의 위장 제목을 쓴다', () => {
    expect(windowTitleFor({ stealthMode: true, disguisedTitle: 'Windows PowerShell', documentName: 'notes.md', dirty: true })).toBe(
      'Windows PowerShell',
    )
  })

  it('은신 모드를 끄면 문서 이름과 md-writer를 보여 준다', () => {
    expect(windowTitleFor({ stealthMode: false, disguisedTitle: 'Windows PowerShell', documentName: 'notes.md', dirty: false })).toBe(
      'notes.md - md-writer',
    )
  })

  it('은신 모드를 끈 상태에서 저장 안 한 변경이 있으면 제목에 표시한다', () => {
    expect(windowTitleFor({ stealthMode: false, disguisedTitle: 'Ubuntu', documentName: 'untitled', dirty: true })).toBe(
      'untitled ● - md-writer',
    )
  })
})

describe('가짜 세션 숨기기', () => {
  function fakePlayer(paused = false) {
    return {
      paused,
      pause() {
        this.paused = true
      },
      resume() {
        this.paused = false
      },
      isPaused() {
        return this.paused
      },
    }
  }

  it('숨기면 가짜 세션을 멈추고 다시 보이면 이어서 흐른다', () => {
    const player = fakePlayer()
    const hider = createSessionHider(player)
    hider.hide()
    expect(player.isPaused()).toBe(true)
    hider.show()
    expect(player.isPaused()).toBe(false)
  })

  it('숨기기 전에 사용자가 멈춰 둔 세션은 다시 보여도 멈춘 채로 둔다', () => {
    const player = fakePlayer(true)
    const hider = createSessionHider(player)
    hider.hide()
    hider.show()
    expect(player.isPaused()).toBe(true)
  })

  it('두 번 숨겨도 다시 보이면 숨기기 전 상태로 돌아간다', () => {
    const player = fakePlayer()
    const hider = createSessionHider(player)
    hider.hide()
    hider.hide()
    hider.show()
    expect(player.isPaused()).toBe(false)
  })
})
