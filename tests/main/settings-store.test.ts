import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../src/main/settings-store'
import { defaultSettings } from '../../src/shared/settings'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imworkinghh-settings-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('설정 파일', () => {
  it('설정 파일이 없으면 기본값으로 시작한다', async () => {
    const store = createSettingsStore({ filePath: join(directory, 'settings.json'), platform: 'win32' })
    expect(await store.load()).toEqual(defaultSettings('win32'))
  })

  it('저장한 설정을 다시 읽으면 그대로 돌아온다', async () => {
    const store = createSettingsStore({ filePath: join(directory, 'settings.json'), platform: 'win32' })
    const changed = { ...defaultSettings('win32'), theme: 'cmd' as const, fontSize: 18 }
    await store.save(changed)
    expect(await store.load()).toEqual(changed)
  })

  it('깨진 설정 파일은 settings.bad.json으로 옮기고 기본값으로 시작한다', async () => {
    const filePath = join(directory, 'settings.json')
    await writeFile(filePath, '{ this is not json')
    const store = createSettingsStore({ filePath, platform: 'darwin' })
    expect(await store.load()).toEqual(defaultSettings('darwin'))
    expect(await readdir(directory)).toEqual(['settings.bad.json'])
    expect(await readFile(join(directory, 'settings.bad.json'), 'utf8')).toBe('{ this is not json')
  })

  it('설정 폴더가 없어도 만들어서 저장한다', async () => {
    const filePath = join(directory, 'nested', 'settings.json')
    const store = createSettingsStore({ filePath, platform: 'win32' })
    await store.save(defaultSettings('win32'))
    expect(JSON.parse(await readFile(filePath, 'utf8')).theme).toBe('windows-terminal')
  })
})
