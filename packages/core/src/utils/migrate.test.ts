import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { migrateV1ToV2 } from './migrate'
import { STORAGE_KEYS } from './storage'
import type { StorageAdapter } from './storage-local'

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

function createMockAdapter(): StorageAdapter & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {}
  return {
    data,
    get<T>(key: string, fallback: T): T {
      return key in data ? (data[key] as T) : fallback
    },
    set<T>(key: string, value: T): void {
      data[key] = value
    },
    remove(key: string): void {
      delete data[key]
    },
    clearAll(): void {
      for (const key of Object.keys(data)) delete data[key]
    },
  }
}

describe('migrateV1ToV2', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    ;(Preferences.get as ReturnType<typeof vi.fn>).mockResolvedValue({ value: null })
  })

  it('跳过已迁移的版本', async () => {
    ;(Preferences.get as ReturnType<typeof vi.fn>).mockResolvedValue({ value: '2' })
    const adapter = createMockAdapter()
    await migrateV1ToV2(adapter)
    expect(Preferences.set).not.toHaveBeenCalled()
  })

  it('将 localStorage 数据迁移到 adapter', async () => {
    localStorage.setItem(STORAGE_KEYS.sources, JSON.stringify([{ id: 's1' }]))
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ theme: 'dark' }))
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([{ id: 'f1' }]))

    const adapter = createMockAdapter()
    await migrateV1ToV2(adapter)

    expect(adapter.get(STORAGE_KEYS.sources, [])).toEqual([{ id: 's1' }])
    expect(adapter.get(STORAGE_KEYS.settings, { theme: 'light' })).toEqual({ theme: 'dark' })
    expect(adapter.get(STORAGE_KEYS.favorites, [])).toEqual([{ id: 'f1' }])
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'hplayer:migrationVersion', value: '2' })
  })

  it('忽略无法解析的 localStorage 数据', async () => {
    localStorage.setItem(STORAGE_KEYS.sources, 'not-json')

    const adapter = createMockAdapter()
    await migrateV1ToV2(adapter)

    expect(adapter.get(STORAGE_KEYS.sources, [])).toEqual([])
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'hplayer:migrationVersion', value: '2' })
  })
})
