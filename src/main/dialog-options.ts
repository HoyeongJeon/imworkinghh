const RESTORE_BUTTONS = ['복구', '버리기']
const DISCARD_LABEL = '버리기'

export function restoreBackupDialog(savedAt: string, unsavedCount: number) {
  return {
    options: {
      type: 'question' as const,
      buttons: RESTORE_BUTTONS,
      defaultId: 0,
      // 백업은 그 글의 유일한 사본이라, 창을 닫거나 Esc로 넘어가도 버리지 않고 복구한다.
      cancelId: 0,
      message: `저장되지 않은 글이 ${unsavedCount}개 있습니다.`,
      detail: `${new Date(savedAt).toLocaleString('ko-KR')}에 자동 백업된 내용을 복구할까요?`,
    },
    choseRestore: (response: number) => RESTORE_BUTTONS[response] !== DISCARD_LABEL,
  }
}
