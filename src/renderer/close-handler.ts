export type CloseHandlerDeps = {
  isStartupFinished(): boolean
  closeWindow(): Promise<boolean>
  closeWindowNow(): void
  pauseAutosave(): void
  resumeAutosave(): void
}

export function createCloseHandler(deps: CloseHandlerDeps): () => Promise<void> {
  return async () => {
    deps.pauseAutosave()
    // 복구 여부를 정하기 전에는 에디터가 비어 있어 "변경 없음"으로 보이므로, 창 닫기 흐름을 타면 백업이 지워진다.
    if (!deps.isStartupFinished()) {
      deps.closeWindowNow()
      return
    }
    if (!(await deps.closeWindow())) deps.resumeAutosave()
  }
}
