import { mkdir, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defaultSettings, normalizeSettings } from '../shared/settings'
import type { Settings } from '../shared/types'
import { writeFileAtomic } from './atomic-write'

export type SettingsStore = {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}

export function createSettingsStore({ filePath, platform }: { filePath: string; platform: string }): SettingsStore {
  async function moveBrokenFileAside(): Promise<void> {
    await rename(filePath, join(dirname(filePath), 'settings.bad.json')).catch(() => undefined)
  }

  return {
    async load() {
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
    },
    async save(settings) {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFileAtomic(filePath, JSON.stringify(settings, null, 2))
    },
  }
}
