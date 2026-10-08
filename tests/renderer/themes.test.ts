import { describe, expect, it } from 'vitest'
import { COLOR_TOKENS, THEMES, getTheme, nextThemeId, renderPrompt, themeCssVariables } from '../../src/renderer/themes'
import { THEME_IDS } from '../../src/shared/types'

describe('터미널 테마', () => {
  it('모든 테마는 화면에 필요한 색을 빠짐없이 가진다', () => {
    for (const theme of Object.values(THEMES)) {
      for (const token of COLOR_TOKENS) {
        expect(theme.colors[token], `${theme.id}.${token}`).toMatch(/^(#|rgba?\()/)
      }
    }
  })

  it('설정에서 고를 수 있는 모든 테마 ID에 테마가 있다', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort())
  })

  it('PowerShell 프롬프트의 {project} 자리에 프로젝트 이름을 넣는다', () => {
    expect(renderPrompt(getTheme('powershell'), 'payments-api')).toBe('PS C:\\dev\\payments-api>')
  })

  it('WSL 테마 프롬프트는 리눅스 경로 형식이다', () => {
    expect(renderPrompt(getTheme('wsl-ubuntu'), 'payments-api')).toBe('user@DESKTOP:~/payments-api$')
  })

  it('맥 테마 프롬프트는 zsh 형식이다', () => {
    expect(renderPrompt(getTheme('macos-basic'), 'payments-api')).toBe('user@MacBook-Pro payments-api %')
  })

  it('테마 순환은 마지막 테마 다음에 처음 테마로 돌아간다', () => {
    expect(nextThemeId('windows-terminal')).toBe('powershell')
    expect(nextThemeId(THEME_IDS[THEME_IDS.length - 1])).toBe(THEME_IDS[0])
  })

  it('색은 CSS 변수 이름으로 바꿔서 적용할 수 있다', () => {
    const variables = themeCssVariables(getTheme('cmd'))
    expect(variables['--color-background']).toBe('#000000')
    expect(variables['--color-diff-add-background']).toBeDefined()
  })

  it('윈도우 계열 테마는 탭 제목줄, 맥 계열은 맥 제목줄을 쓴다', () => {
    expect(getTheme('wsl-ubuntu').titlebarStyle).toBe('windows')
    expect(getTheme('macos-homebrew').titlebarStyle).toBe('mac')
  })
})
