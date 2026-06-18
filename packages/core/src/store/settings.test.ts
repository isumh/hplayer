import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDeviceType } from '../api/ua-pool'
import type { Settings } from '../types/settings'
import { STORAGE_KEYS } from '../utils/storage'
import { useSettingsStore } from './settings'

vi.mock('../api/ua-pool', () => ({
  setDeviceType: vi.fn(),
}))

function mockLocalStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key]
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    length: 0,
  } as unknown as Storage
}

function mockMatchMedia(matches = false): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    const ls = mockLocalStorage()
    vi.stubGlobal('localStorage', ls)
    vi.clearAllMocks()
    mockMatchMedia()
    setActivePinia(createPinia())
  })

  it('默认主题为 auto，设备类型为 mobile', () => {
    const s = useSettingsStore()
    expect(s.settings.theme).toBe('auto')
    expect(s.settings.deviceType).toBe('mobile')
  })

  it('setTheme 切换并持久化', () => {
    const s = useSettingsStore()
    s.setTheme('dark')
    expect(s.settings.theme).toBe('dark')
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    expect(raw).toBeTruthy()
    expect((JSON.parse(raw!) as Settings).theme).toBe('dark')
  })

  it('setDeviceType 切换并触发 UA 池重建', () => {
    const s = useSettingsStore()
    s.setDeviceType('desktop')
    expect(s.settings.deviceType).toBe('desktop')
    expect(setDeviceType).toHaveBeenCalledWith('desktop')
  })

  it('从 localStorage 恢复设置', () => {
    const saved: Settings = { theme: 'light', deviceType: 'tablet' }
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(saved))
    const s = useSettingsStore()
    expect(s.settings.theme).toBe('light')
    expect(s.settings.deviceType).toBe('tablet')
  })
})
