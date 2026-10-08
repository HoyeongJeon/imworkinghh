// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { installFileDrop } from '../../src/renderer/file-drop'

function dropEvent(type: 'drop' | 'dragover', files: File[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { files } })
  return event
}

function setup() {
  const dropped: string[] = []
  installFileDrop(document, {
    pathForFile: (file) => `C:\\notes\\${file.name}`,
    onFileDropped: (path) => dropped.push(path),
  })
  return { dropped }
}

describe('파일 끌어다 놓기', () => {
  it('창에 파일을 끌고 오면 브라우저가 파일로 화면을 바꾸지 못하게 막는다', () => {
    setup()
    const event = dropEvent('dragover', [new File(['x'], 'a.md')])
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('파일을 놓으면 화면을 바꾸지 않고 그 파일을 연다', () => {
    const { dropped } = setup()
    const event = dropEvent('drop', [new File(['x'], '회의록.md')])
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(dropped.at(-1)).toBe('C:\\notes\\회의록.md')
  })

  it('파일이 아닌 것을 놓으면 아무것도 열지 않는다', () => {
    const { dropped } = setup()
    const before = dropped.length
    document.body.dispatchEvent(dropEvent('drop', []))
    expect(dropped).toHaveLength(before)
  })
})
