import { describe, expect, it } from 'vitest'
import { createCloseHandler } from '../../src/renderer/close-handler'

function setup({ startupFinished, documentCloses }: { startupFinished: boolean; documentCloses: boolean }) {
  const calls: string[] = []
  const handleClose = createCloseHandler({
    isStartupFinished: () => startupFinished,
    closeDocument: async () => {
      calls.push('closeDocument')
      return documentCloses
    },
    closeWindowNow: () => calls.push('closeWindowNow'),
    pauseAutosave: () => calls.push('pauseAutosave'),
    resumeAutosave: () => calls.push('resumeAutosave'),
  })
  return { handleClose, calls }
}

describe('창 닫기 요청', () => {
  it('시작할 때 복구 여부를 정하기 전에 닫으면 백업을 지우지 않고 바로 닫는다', async () => {
    const { handleClose, calls } = setup({ startupFinished: false, documentCloses: true })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeWindowNow'])
  })

  it('시작이 끝난 뒤에는 저장 확인을 거쳐 닫는다', async () => {
    const { handleClose, calls } = setup({ startupFinished: true, documentCloses: true })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeDocument'])
  })

  it('저장 확인에서 취소하면 자동 백업을 다시 시작한다', async () => {
    const { handleClose, calls } = setup({ startupFinished: true, documentCloses: false })
    await handleClose()
    expect(calls).toEqual(['pauseAutosave', 'closeDocument', 'resumeAutosave'])
  })
})
