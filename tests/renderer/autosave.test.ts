import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_INTERVAL_MS, backupSetOf, createAutosave, unsavedPaneCount } from '../../src/renderer/autosave'
import type { BackupSet, PaneBackup } from '../../src/shared/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const SAVED_AT = '2026-10-08T00:00:00.000Z'
const paneOf = (unsavedContent: string | null): PaneBackup => ({ path: null, eol: 'lf', unsavedContent })
const backupOf = (...contents: (string | null)[]): BackupSet => ({ savedAt: SAVED_AT, panes: contents.map(paneOf) })

function setup(initialSnapshot: BackupSet | null) {
  let snapshot = initialSnapshot
  const calls: string[] = []
  let failNextWrite = false
  const autosave = createAutosave({
    takeSnapshot: () => snapshot,
    writeBackup: async (backup) => {
      if (failNextWrite) {
        failNextWrite = false
        throw new Error('disk')
      }
      calls.push(`write ${backup.panes.map((pane) => pane.unsavedContent ?? '-').join('|')}`)
    },
    clearBackup: async () => {
      calls.push('clear')
    },
  })
  return {
    autosave,
    calls,
    setSnapshot: (next: BackupSet | null) => (snapshot = next),
    failNextWrite: () => (failNextWrite = true),
  }
}

describe('자동 백업', () => {
  it('30초마다 저장 안 한 칸이 있으면 모든 칸을 백업한다', async () => {
    const { autosave, calls } = setup(backupOf('쓰는 중', null))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toEqual(['write 쓰는 중|-'])
  })

  it('저장 안 한 칸이 없으면 백업을 한 번 지우고 그 뒤로는 지우지 않는다', async () => {
    const { autosave, calls } = setup(null)
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(calls).toEqual(['clear'])
  })

  it('지난 백업과 내용이 같으면 다시 백업하지 않는다', async () => {
    const { autosave, calls } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(calls).toEqual(['write 같은 글'])
  })

  it('내용이 바뀌면 다음 주기에 다시 백업한다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('첫 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(backupOf('고친 글'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(calls).toEqual(['write 첫 글', 'write 고친 글'])
  })

  it('모든 칸을 저장해 백업할 내용이 없어지면 백업을 지운다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(null)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(calls).toEqual(['write 글', 'clear'])
  })

  it('바로 백업하라고 하면 주기를 기다리지 않고 백업한다', async () => {
    const { autosave, calls } = setup(backupOf('글'))
    autosave.start()
    await autosave.flushNow()
    expect(calls).toEqual(['write 글'])
  })

  it('멈춘 뒤에도 바로 백업하라고 하면 백업한다', async () => {
    const { autosave, calls, setSnapshot } = setup(backupOf('첫 칸 글', '둘째 칸 글'))
    autosave.start()
    await autosave.flushNow()
    autosave.stop()
    setSnapshot(backupOf(null, '둘째 칸 글'))
    await autosave.flushNow()
    expect(calls).toEqual(['write 첫 칸 글|둘째 칸 글', 'write -|둘째 칸 글'])
  })

  it('백업에 실패하면 다음 주기에 다시 시도한다', async () => {
    const { autosave, calls, failNextWrite } = setup(backupOf('글'))
    failNextWrite()
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(calls).toEqual(['write 글'])
  })

  it('멈추면 더 이상 주기적으로 백업하지 않는다', async () => {
    const { autosave, calls } = setup(backupOf('글'))
    autosave.start()
    autosave.stop()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(calls).toEqual([])
  })
})

describe('백업할 칸 모음', () => {
  it('저장 안 한 칸이 하나도 없으면 백업할 내용이 없다', () => {
    expect(backupSetOf([paneOf(null), paneOf(null)], SAVED_AT)).toBeNull()
  })

  it('저장 안 한 칸이 있으면 모든 칸을 칸 순서대로 담는다', () => {
    expect(backupSetOf([paneOf(null), paneOf('글')], SAVED_AT)).toEqual(backupOf(null, '글'))
  })

  it('저장 안 한 칸 수를 센다', () => {
    expect(unsavedPaneCount(backupOf('가', null, '나'))).toBe(2)
  })
})
