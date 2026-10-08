import type { LogSegment, LogSink } from './events'

export const MAX_LOG_LINES = 3000
const BOTTOM_TOLERANCE_PX = 4

export function createLogView(container: HTMLElement, { maxLines = MAX_LOG_LINES } = {}): LogSink {
  const doc = container.ownerDocument

  function renderSegments(lineElement: Element, segments: LogSegment[]): void {
    lineElement.replaceChildren(
      ...segments.map((segment) => {
        const span = doc.createElement('span')
        span.className = `role-${segment.role}`
        span.textContent = segment.text
        return span
      }),
    )
  }

  function isScrolledToBottom(): boolean {
    return container.scrollTop + container.clientHeight >= container.scrollHeight - BOTTOM_TOLERANCE_PX
  }

  function followIfWasAtBottom(wasAtBottom: boolean): void {
    if (wasAtBottom) container.scrollTop = container.scrollHeight
  }

  function appendLine(segments: LogSegment[]): void {
    const wasAtBottom = isScrolledToBottom()
    const lineElement = doc.createElement('div')
    lineElement.className = 'log-line'
    renderSegments(lineElement, segments)
    container.append(lineElement)
    while (container.childElementCount > maxLines) container.firstElementChild?.remove()
    followIfWasAtBottom(wasAtBottom)
  }

  function replaceLastLine(segments: LogSegment[]): void {
    const lastLine = container.lastElementChild
    if (!lastLine) {
      appendLine(segments)
      return
    }
    const wasAtBottom = isScrolledToBottom()
    renderSegments(lastLine, segments)
    followIfWasAtBottom(wasAtBottom)
  }

  return { appendLine, replaceLastLine }
}
