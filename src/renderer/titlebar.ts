import type { TitlebarStyle } from './themes'

export type WindowActions = {
  minimize(): void
  toggleMaximize(): void
  close(): void
}

export type Titlebar = { render(style: TitlebarStyle, title: string): void }

export function createTitlebar(
  element: HTMLElement,
  { platform, actions }: { platform: string; actions: WindowActions },
): Titlebar {
  const doc = element.ownerDocument
  const usesNativeWindowButtons = platform === 'darwin'

  function el(tag: string, className: string, text = ''): HTMLElement {
    const node = doc.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }

  function windowButton(action: keyof WindowActions, label: string, className: string): HTMLElement {
    const button = el('button', `tb-button ${className}`, label) as HTMLButtonElement
    button.type = 'button'
    button.dataset.action = action
    button.addEventListener('click', () => actions[action]())
    return button
  }

  function windowsStyle(title: string): HTMLElement[] {
    const tab = el('div', 'tb-tab')
    tab.append(el('span', 'tb-tab-icon', '>_'), el('span', 'tb-tab-title', title), el('span', 'tb-tab-close', '✕'))
    const parts = [tab, el('span', 'tb-new-tab', '+'), el('span', 'tb-dropdown', '⌄'), el('div', 'tb-drag-space')]
    if (!usesNativeWindowButtons) {
      parts.push(
        windowButton('minimize', '─', 'tb-minimize'),
        windowButton('toggleMaximize', '□', 'tb-maximize'),
        windowButton('close', '✕', 'tb-close'),
      )
    }
    return parts
  }

  function macStyle(title: string): HTMLElement[] {
    const parts: HTMLElement[] = []
    if (!usesNativeWindowButtons) {
      const lights = el('div', 'tb-traffic-lights')
      lights.append(
        windowButton('close', '', 'tb-light tb-light-close'),
        windowButton('minimize', '', 'tb-light tb-light-minimize'),
        windowButton('toggleMaximize', '', 'tb-light tb-light-maximize'),
      )
      parts.push(lights)
    }
    parts.push(el('div', 'tb-mac-title', title))
    return parts
  }

  return {
    render(style, title) {
      element.className = `titlebar titlebar-${style}${usesNativeWindowButtons ? ' titlebar-native-buttons' : ''}`
      element.replaceChildren(...(style === 'windows' ? windowsStyle(title) : macStyle(title)))
    },
  }
}
