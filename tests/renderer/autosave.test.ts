import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_INTERVAL_MS, createAutosave } from '../../src/renderer/autosave'
import type { Backup } from '../../src/shared/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const backupOf = (content: string): Backup => ({ path: null, content, eol: 'lf', savedAt: '2026-10-08T00:00:00.000Z' })

function setup(initialSnapshot: Backup | null) {
  let snapshot = initialSnapshot
  const written: string[] = []
  let failNextWrite = false
  const autosave = createAutosave({
    takeSnapshot: () => snapshot,
    writeBackup: async (backup) => {
      if (failNextWrite) {
        failNextWrite = false
        throw new Error('disk')
      }
      written.push(backup.content)
    },
  })
  return {
    autosave,
    written,
    setSnapshot: (next: Backup | null) => (snapshot = next),
    failNextWrite: () => (failNextWrite = true),
  }
}

describe('자동 백업', () => {
  it('30초마다 백업할 내용이 있으면 백업한다', async () => {
    const { autosave, written } = setup(backupOf('쓰는 중'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1)
    expect(written).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(written).toEqual(['쓰는 중'])
  })

  it('백업할 내용이 없으면 백업하지 않는다', async () => {
    const { autosave, written } = setup(null)
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(written).toEqual([])
  })

  it('지난 백업과 내용이 같으면 다시 백업하지 않는다', async () => {
    const { autosave, written } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(written).toEqual(['같은 글'])
  })

  it('내용이 바뀌면 다음 주기에 다시 백업한다', async () => {
    const { autosave, written, setSnapshot } = setup(backupOf('첫 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    setSnapshot(backupOf('고친 글'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(written).toEqual(['첫 글', '고친 글'])
  })

  it('지난 백업을 잊은 뒤에는 같은 내용이라도 다시 백업한다', async () => {
    const { autosave, written } = setup(backupOf('같은 글'))
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    autosave.forgetLastBackup()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(written).toEqual(['같은 글', '같은 글'])
  })

  it('백업에 실패하면 다음 주기에 다시 시도한다', async () => {
    const { autosave, written, failNextWrite } = setup(backupOf('글'))
    failNextWrite()
    autosave.start()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(written).toEqual(['글'])
  })

  it('멈추면 더 이상 백업하지 않는다', async () => {
    const { autosave, written } = setup(backupOf('글'))
    autosave.start()
    autosave.stop()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)
    expect(written).toEqual([])
  })
})
