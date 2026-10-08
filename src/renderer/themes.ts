import { THEME_IDS, type ThemeId } from '../shared/types'

export type TitlebarStyle = 'windows' | 'mac'

export const COLOR_TOKENS = [
  'background',
  'foreground',
  'muted',
  'selection',
  'cursor',
  'gutter',
  'divider',
  'activeLine',
  'titlebarBackground',
  'titlebarForeground',
  'tabBackground',
  'statusBackground',
  'statusForeground',
  'prompt',
  'userInput',
  'toolBullet',
  'toolName',
  'toolArg',
  'result',
  'diffAdd',
  'diffRemove',
  'diffAddBackground',
  'diffRemoveBackground',
  'thinking',
  'success',
  'mdHeading',
  'mdStrong',
  'mdEmphasis',
  'mdCode',
  'mdLink',
  'mdQuote',
  'mdMeta',
] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

export type Theme = {
  id: ThemeId
  name: string
  titlebarStyle: TitlebarStyle
  windowTitle: string
  promptTemplate: string
  colors: Record<ColorToken, string>
}

type AnsiPalette = {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

const CLAUDE_ORANGE = '#D77757'
const HOMEBREW_GREEN = '#28FE14'

const CAMPBELL: AnsiPalette = {
  background: '#0C0C0C',
  foreground: '#CCCCCC',
  cursor: '#FFFFFF',
  selection: '#3A3D41',
  black: '#0C0C0C',
  red: '#C50F1F',
  green: '#13A10E',
  yellow: '#C19C00',
  blue: '#0037DA',
  magenta: '#881798',
  cyan: '#3A96DD',
  white: '#CCCCCC',
  brightBlack: '#767676',
  brightRed: '#E74856',
  brightGreen: '#16C60C',
  brightYellow: '#F9F1A5',
  brightBlue: '#3B78FF',
  brightMagenta: '#B4009E',
  brightCyan: '#61D6D6',
  brightWhite: '#F2F2F2',
}

const VINTAGE: AnsiPalette = {
  background: '#000000',
  foreground: '#C0C0C0',
  cursor: '#FFFFFF',
  selection: '#404040',
  black: '#000000',
  red: '#800000',
  green: '#008000',
  yellow: '#808000',
  blue: '#000080',
  magenta: '#800080',
  cyan: '#008080',
  white: '#C0C0C0',
  brightBlack: '#808080',
  brightRed: '#FF0000',
  brightGreen: '#00FF00',
  brightYellow: '#FFFF00',
  brightBlue: '#0000FF',
  brightMagenta: '#FF00FF',
  brightCyan: '#00FFFF',
  brightWhite: '#FFFFFF',
}

const UBUNTU: AnsiPalette = {
  background: '#300A24',
  foreground: '#EEEEEC',
  cursor: '#BBBBBB',
  selection: '#5E2750',
  black: '#2E3436',
  red: '#CC0000',
  green: '#4E9A06',
  yellow: '#C4A000',
  blue: '#3465A4',
  magenta: '#75507B',
  cyan: '#06989A',
  white: '#D3D7CF',
  brightBlack: '#8A8A8A',
  brightRed: '#EF2929',
  brightGreen: '#8AE234',
  brightYellow: '#FCE94F',
  brightBlue: '#729FCF',
  brightMagenta: '#AD7FA8',
  brightCyan: '#34E2E2',
  brightWhite: '#EEEEEC',
}

const TERMINAL_APP: AnsiPalette = {
  background: '#1E1E1E',
  foreground: '#E5E5E5',
  cursor: '#E5E5E5',
  selection: '#3F638B',
  black: '#000000',
  red: '#C23621',
  green: '#25BC24',
  yellow: '#ADAD27',
  blue: '#492EE1',
  magenta: '#D338D3',
  cyan: '#33BBC8',
  white: '#CBCCCD',
  brightBlack: '#818383',
  brightRed: '#FC391F',
  brightGreen: '#31E722',
  brightYellow: '#EAEC23',
  brightBlue: '#5833FF',
  brightMagenta: '#F935F8',
  brightCyan: '#14F0F0',
  brightWhite: '#E9EBEB',
}

const POWERSHELL_PALETTE: AnsiPalette = { ...CAMPBELL, background: '#012456', selection: '#1F4E8C' }

const HOMEBREW_PALETTE: AnsiPalette = {
  ...TERMINAL_APP,
  background: '#000000',
  foreground: HOMEBREW_GREEN,
  cursor: HOMEBREW_GREEN,
  selection: '#083905',
}

function colorsFromPalette(palette: AnsiPalette, titlebarBackground: string): Record<ColorToken, string> {
  return {
    background: palette.background,
    foreground: palette.foreground,
    muted: palette.brightBlack,
    selection: palette.selection,
    cursor: palette.cursor,
    gutter: palette.brightBlack,
    divider: palette.brightBlack,
    activeLine: 'rgba(255, 255, 255, 0.04)',
    titlebarBackground,
    titlebarForeground: palette.foreground,
    tabBackground: palette.background,
    statusBackground: palette.background,
    statusForeground: palette.brightBlack,
    prompt: palette.foreground,
    userInput: palette.brightWhite,
    toolBullet: palette.brightGreen,
    toolName: palette.brightWhite,
    toolArg: palette.foreground,
    result: palette.brightBlack,
    diffAdd: palette.brightGreen,
    diffRemove: palette.brightRed,
    diffAddBackground: 'rgba(46, 160, 67, 0.15)',
    diffRemoveBackground: 'rgba(248, 81, 73, 0.15)',
    thinking: CLAUDE_ORANGE,
    success: palette.brightGreen,
    mdHeading: palette.brightGreen,
    mdStrong: palette.brightYellow,
    mdEmphasis: palette.yellow,
    mdCode: palette.brightCyan,
    mdLink: palette.brightBlue,
    mdQuote: palette.brightBlack,
    mdMeta: palette.brightBlack,
  }
}

export const THEMES: Record<ThemeId, Theme> = {
  'windows-terminal': {
    id: 'windows-terminal',
    name: 'Windows Terminal',
    titlebarStyle: 'windows',
    windowTitle: 'Windows PowerShell',
    promptTemplate: 'PS C:\\dev\\{project}>',
    colors: colorsFromPalette(CAMPBELL, '#1F1F1F'),
  },
  powershell: {
    id: 'powershell',
    name: 'PowerShell',
    titlebarStyle: 'windows',
    windowTitle: 'Windows PowerShell',
    promptTemplate: 'PS C:\\dev\\{project}>',
    colors: colorsFromPalette(POWERSHELL_PALETTE, '#1F1F1F'),
  },
  cmd: {
    id: 'cmd',
    name: 'CMD',
    titlebarStyle: 'windows',
    windowTitle: '명령 프롬프트',
    promptTemplate: 'C:\\dev\\{project}>',
    colors: colorsFromPalette(VINTAGE, '#1F1F1F'),
  },
  'wsl-ubuntu': {
    id: 'wsl-ubuntu',
    name: 'WSL Ubuntu',
    titlebarStyle: 'windows',
    windowTitle: 'Ubuntu',
    promptTemplate: 'user@DESKTOP:~/{project}$',
    colors: colorsFromPalette(UBUNTU, '#1F1F1F'),
  },
  'macos-basic': {
    id: 'macos-basic',
    name: 'macOS Basic',
    titlebarStyle: 'mac',
    windowTitle: 'user — claude — 120×40',
    promptTemplate: 'user@MacBook-Pro {project} %',
    colors: colorsFromPalette(TERMINAL_APP, '#2B2B2B'),
  },
  'macos-homebrew': {
    id: 'macos-homebrew',
    name: 'macOS Homebrew',
    titlebarStyle: 'mac',
    windowTitle: 'user — claude — 120×40',
    promptTemplate: 'user@MacBook-Pro {project} %',
    colors: {
      ...colorsFromPalette(HOMEBREW_PALETTE, '#2B2B2B'),
      userInput: HOMEBREW_GREEN,
      toolName: HOMEBREW_GREEN,
      toolArg: HOMEBREW_GREEN,
    },
  },
}

export function getTheme(id: ThemeId): Theme {
  return THEMES[id]
}

export function renderPrompt(theme: Theme, project: string): string {
  return theme.promptTemplate.replaceAll('{project}', project)
}

export function nextThemeId(current: ThemeId): ThemeId {
  const index = THEME_IDS.indexOf(current)
  return THEME_IDS[(index + 1) % THEME_IDS.length]
}

export function themeCssVariables(theme: Theme): Record<string, string> {
  return Object.fromEntries(COLOR_TOKENS.map((token) => [`--color-${toKebabCase(token)}`, theme.colors[token]]))
}

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
