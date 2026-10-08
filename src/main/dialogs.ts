import { dialog, type BrowserWindow } from 'electron'
import type { DiscardChoice } from '../shared/api'
import { restoreBackupDialog } from './dialog-options'
import { OPEN_DIALOG_FILTERS, saveDialogFilters } from './file-format'
import type { FileDialogs } from './file-service'

export type AppDialogs = FileDialogs & {
  confirmDiscard(): Promise<DiscardChoice>
  askRestoreBackup(savedAt: string): Promise<boolean>
}

const DISCARD_CHOICE_BY_BUTTON: DiscardChoice[] = ['save', 'discard', 'cancel']

export function createElectronDialogs(window: BrowserWindow): AppDialogs {
  return {
    async pickOpenPath(defaultDirectory) {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        defaultPath: defaultDirectory ?? undefined,
        filters: OPEN_DIALOG_FILTERS,
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    async pickSavePath(suggestedPath, preferredFormat) {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: suggestedPath,
        filters: saveDialogFilters(preferredFormat),
      })
      return result.canceled || !result.filePath ? null : result.filePath
    },

    async confirmLargeFile(bytes) {
      const megabytes = (bytes / 1024 / 1024).toFixed(1)
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['열기', '취소'],
        defaultId: 1,
        cancelId: 1,
        message: '큰 파일입니다.',
        detail: `${megabytes}MB 파일입니다. 열면 느려질 수 있습니다. 열까요?`,
      })
      return response === 0
    },

    async confirmOverwrite(path) {
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['덮어쓰기', '취소'],
        defaultId: 1,
        cancelId: 1,
        message: '같은 이름의 파일이 이미 있습니다.',
        detail: `${path}\n덮어쓸까요?`,
      })
      return response === 0
    },

    async showError(title, message) {
      await dialog.showMessageBox(window, { type: 'error', buttons: ['확인'], message: title, detail: message })
    },

    async confirmDiscard() {
      const { response } = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['저장', '저장 안 함', '취소'],
        defaultId: 0,
        cancelId: 2,
        message: '저장하지 않은 변경 사항이 있습니다.',
        detail: '저장할까요?',
      })
      return DISCARD_CHOICE_BY_BUTTON[response] ?? 'cancel'
    },

    async askRestoreBackup(savedAt) {
      const { options, choseRestore } = restoreBackupDialog(savedAt)
      const { response } = await dialog.showMessageBox(window, options)
      return choseRestore(response)
    },
  }
}
