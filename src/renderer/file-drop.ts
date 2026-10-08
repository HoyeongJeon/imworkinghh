export type FileDropOptions = {
  pathForFile(file: File): string
  onFileDropped(path: string): void
}

// 캡처 단계에서 받는다. 에디터가 먼저 받으면 파일 내용을 글 중간에 붙여 넣는다.
export function installFileDrop(target: Document, { pathForFile, onFileDropped }: FileDropOptions): void {
  target.addEventListener('dragover', (event) => event.preventDefault(), true)
  target.addEventListener(
    'drop',
    (event) => {
      const file = (event as DragEvent).dataTransfer?.files[0]
      event.preventDefault()
      if (!file) return
      event.stopPropagation()
      onFileDropped(pathForFile(file))
    },
    true,
  )
}
