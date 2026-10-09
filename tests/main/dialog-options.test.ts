import { describe, expect, it } from 'vitest'
import { restoreBackupDialog } from '../../src/main/dialog-options'

describe('백업 복구 질문', () => {
  it('저장되지 않은 글 개수를 알려 준다', () => {
    expect(restoreBackupDialog('2026-10-08T05:00:00.000Z', 2).options.message).toBe('저장되지 않은 글이 2개 있습니다.')
  })

  it('질문 창을 닫거나 Esc를 누르면 복구를 고른 것으로 본다', () => {
    const { options, choseRestore } = restoreBackupDialog('2026-10-08T05:00:00.000Z', 1)
    expect(choseRestore(options.cancelId)).toBe(true)
  })

  it('버리기를 직접 눌렀을 때만 복구하지 않는다', () => {
    const { options, choseRestore } = restoreBackupDialog('2026-10-08T05:00:00.000Z', 1)
    const discardIndex = options.buttons.indexOf('버리기')
    expect(choseRestore(discardIndex)).toBe(false)
    expect(choseRestore(options.buttons.indexOf('복구'))).toBe(true)
  })
})
