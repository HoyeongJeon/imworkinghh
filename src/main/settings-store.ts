import { mkdir, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defaultSettings, normalizeSettings } from '../shared/settings'
import type { Settings } from '../shared/types'
import { writeFileAtomic } from './atomic-write'
import { createSerialQueue } from './serial-queue'

export type SettingsStore = {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}

export function createSettingsStore({ filePath, platform }: { filePath: string; platform: string }): SettingsStore {
  async function moveBrokenFileAside(): Promise<void> {
    await rename(filePath, join(dirname(filePath), 'settings.bad.json')).catch(() => undefined)
  }

  // 화면의 설정 저장과 창을 닫을 때의 창 위치 저장이 겹치면 오래된 설정이 새 설정을 덮으므로 순서대로 처리한다.
  const queue = createSerialQueue()
  return {
    load: () =>
      queue.run(async () => {
        let raw: string
        try {
          raw = await readFile(filePath, 'utf8')
        } catch {
          return defaultSettings(platform)
        }
        try {
          return normalizeSettings(JSON.parse(raw), platform)
        } catch {
          await moveBrokenFileAside()
          return defaultSettings(platform)
        }
      }),
    save: (settings) =>
      queue.run(async () => {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFileAtomic(filePath, JSON.stringify(settings, null, 2))
      }),
  }
}
