import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, storage } from './storage'

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

describe('storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('set/get 对象', () => {
    storage.set(STORAGE_KEYS.sources, [{ id: 's1' }])
    const got = storage.get<unknown[]>(STORAGE_KEYS.sources, [])
    expect(got).toEqual([{ id: 's1' }])
  })

  it('get 不存在返回 fallback', () => {
    expect(storage.get(STORAGE_KEYS.history, [])).toEqual([])
    expect(storage.get(STORAGE_KEYS.settings, { theme: 'light' })).toEqual({ theme: 'light' })
  })

  it('get 非法 JSON 返回 fallback', () => {
    localStorage.setItem(STORAGE_KEYS.sources, 'not-json')
    expect(storage.get<unknown[]>(STORAGE_KEYS.sources, [])).toEqual([])
  })

  it('remove 删除键', () => {
    storage.set(STORAGE_KEYS.sources, [{ id: 's1' }])
    storage.remove(STORAGE_KEYS.sources)
    expect(localStorage.getItem(STORAGE_KEYS.sources)).toBeNull()
  })

  it('clearAll 清空', () => {
    storage.set(STORAGE_KEYS.sources, [{ id: 's1' }])
    storage.set(STORAGE_KEYS.favorites, [{ id: 'f1' }])
    storage.clearAll()
    expect(localStorage.getItem(STORAGE_KEYS.sources)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.favorites)).toBeNull()
  })

  it('set 失败不抛错', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => {
        throw new Error('quota exceeded')
      }),
    } as unknown as Storage)
    expect(() => storage.set(STORAGE_KEYS.sources, [])).not.toThrow()
  })
})
