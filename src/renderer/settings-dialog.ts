import { FONT_SIZE_RANGE } from '../shared/settings'
import { FILE_FORMATS, LOG_SPEEDS, type FileFormat, type LogSpeed, type Settings, type ThemeId } from '../shared/types'
import { displayShortcut, isUsableAppShortcut } from './shortcuts'

export type SettingsDialog = {
  open(current: Settings): void
  close(): void
  isOpen(): boolean
}

export type SettingsDialogOptions = {
  host: HTMLElement
  platform: string
  themes: { id: ThemeId; name: string }[]
  onChange(patch: Partial<Settings>): void
}

const LOG_SPEED_LABELS: Record<LogSpeed, string> = { slow: '느림', normal: '보통', fast: '빠름' }
const FORMAT_LABELS: Record<FileFormat, string> = { md: 'Markdown (.md)', txt: 'Text (.txt)' }

type Option = { value: string; label: string }

export function createSettingsDialog({ host, platform, themes, onChange }: SettingsDialogOptions): SettingsDialog {
  const doc = host.ownerDocument
  let overlay: HTMLElement | null = null

  // 창을 연 뒤에도 글꼴 크기나 마지막 파일은 바뀔 수 있으므로, 연 시점의 사본 전체가 아니라 바꾼 항목만 알린다.
  function update(patch: Partial<Settings>): void {
    if (overlay) onChange(patch)
  }

  function row(label: string, control: HTMLElement): HTMLElement {
    const wrapper = doc.createElement('label')
    wrapper.className = 'settings-row'
    const text = doc.createElement('span')
    text.textContent = label
    wrapper.append(text, control)
    return wrapper
  }

  function selectRow(
    label: string,
    name: keyof Settings,
    options: Option[],
    value: string,
    onSelect: (value: string) => void,
  ): HTMLElement {
    const select = doc.createElement('select')
    select.name = name
    for (const option of options) {
      const element = doc.createElement('option')
      element.value = option.value
      element.textContent = option.label
      select.append(element)
    }
    select.value = value
    select.addEventListener('change', () => onSelect(select.value))
    return row(label, select)
  }

  function checkboxRow(
    label: string,
    name: keyof Settings,
    checked: boolean,
    onToggle: (checked: boolean) => void,
  ): HTMLElement {
    const input = doc.createElement('input')
    input.type = 'checkbox'
    input.name = name
    input.checked = checked
    input.addEventListener('change', () => onToggle(input.checked))
    return row(label, input)
  }

  function panicKeyRow(value: string): HTMLElement {
    const input = doc.createElement('input')
    input.type = 'text'
    input.name = 'panicKey'
    input.value = displayShortcut(value, platform)
    // 입력 중간값(예: 'm')이 그대로 저장되면 글을 쓸 때마다 패닉이 실행되므로 입력을 마쳤을 때만 반영한다.
    input.addEventListener('input', () => input.classList.toggle('invalid', !isUsableAppShortcut(input.value)))
    input.addEventListener('change', () => {
      if (isUsableAppShortcut(input.value)) update({ panicKey: input.value })
    })
    return row('패닉 키', input)
  }

  function fontSizeRow(value: number): HTMLElement {
    const input = doc.createElement('input')
    input.type = 'number'
    input.name = 'fontSize'
    input.min = String(FONT_SIZE_RANGE.min)
    input.max = String(FONT_SIZE_RANGE.max)
    input.value = String(value)
    input.addEventListener('change', () => {
      const size = Number(input.value)
      const isValid = Number.isInteger(size) && size >= FONT_SIZE_RANGE.min && size <= FONT_SIZE_RANGE.max
      input.classList.toggle('invalid', !isValid)
      if (isValid) update({ fontSize: size })
    })
    return row('글꼴 크기', input)
  }

  function close(): void {
    overlay?.remove()
    overlay = null
  }

  function open(settings: Settings): void {
    close()
    overlay = doc.createElement('div')
    overlay.className = 'settings-overlay'
    const panel = doc.createElement('div')
    panel.className = 'settings-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'settings')

    const title = doc.createElement('div')
    title.className = 'settings-title'
    title.textContent = '# settings'

    const closeButton = doc.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'settings-close'
    closeButton.textContent = 'close (Esc)'
    closeButton.addEventListener('click', close)

    panel.append(
      title,
      checkboxRow('은신 모드', 'stealthMode', settings.stealthMode, (checked) => update({ stealthMode: checked })),
      selectRow(
        '테마',
        'theme',
        themes.map((theme) => ({ value: theme.id, label: theme.name })),
        settings.theme,
        (value) => update({ theme: value as ThemeId }),
      ),
      selectRow(
        '로그 속도',
        'logSpeed',
        LOG_SPEEDS.map((speed) => ({ value: speed, label: LOG_SPEED_LABELS[speed] })),
        settings.logSpeed,
        (value) => update({ logSpeed: value as LogSpeed }),
      ),
      checkboxRow('문법 색칠', 'syntaxHighlight', settings.syntaxHighlight, (checked) =>
        update({ syntaxHighlight: checked }),
      ),
      checkboxRow('타이핑 연동', 'typingLink', settings.typingLink, (checked) => update({ typingLink: checked })),
      checkboxRow('패닉 키 사용', 'panicEnabled', settings.panicEnabled, (checked) => update({ panicEnabled: checked })),
      panicKeyRow(settings.panicKey),
      fontSizeRow(settings.fontSize),
      selectRow(
        '기본 저장 형식',
        'defaultFormat',
        FILE_FORMATS.map((format) => ({ value: format, label: FORMAT_LABELS[format] })),
        settings.defaultFormat,
        (value) => update({ defaultFormat: value as FileFormat }),
      ),
      closeButton,
    )

    overlay.append(panel)
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close()
    })
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    })
    host.append(overlay)
    panel.querySelector('select')?.focus()
  }

  return { open, close, isOpen: () => overlay !== null }
}
