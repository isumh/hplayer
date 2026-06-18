import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FavoriteItem } from '../types/favorite'
import { STORAGE_KEYS } from '../utils/storage'
import { useFavoriteStore } from './favorite'

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

function sampleFavorite(): Omit<FavoriteItem, 'id' | 'createdAt'> {
  return {
    sourceId: 's1',
    vod: {
      id: 'v1',
      sourceId: 's1',
      name: '影片A',
      pic: 'https://x.com/a.jpg',
    },
  }
}

describe('useFavoriteStore', () => {
  beforeEach(() => {
    const ls = mockLocalStorage()
    vi.stubGlobal('localStorage', ls)
    setActivePinia(createPinia())
  })

  it('添加收藏', () => {
    const s = useFavoriteStore()
    s.add(sampleFavorite())
    expect(s.items).toHaveLength(1)
    expect(s.items[0]?.vod.name).toBe('影片A')
    expect(s.isFavorited('v1', 's1')).toBe(true)
  })

  it('重复添加不会重复', () => {
    const s = useFavoriteStore()
    s.add(sampleFavorite())
    s.add(sampleFavorite())
    expect(s.items).toHaveLength(1)
  })

  it('移除收藏', () => {
    const s = useFavoriteStore()
    s.add(sampleFavorite())
    s.remove('v1', 's1')
    expect(s.items).toHaveLength(0)
    expect(s.isFavorited('v1', 's1')).toBe(false)
  })

  it('toggle 未收藏时添加', () => {
    const s = useFavoriteStore()
    const result = s.toggle(sampleFavorite())
    expect(result).toBe(true)
    expect(s.items).toHaveLength(1)
  })

  it('toggle 已收藏时移除', () => {
    const s = useFavoriteStore()
    s.add(sampleFavorite())
    const result = s.toggle(sampleFavorite())
    expect(result).toBe(false)
    expect(s.items).toHaveLength(0)
  })

  it('持久化到 localStorage', () => {
    const s = useFavoriteStore()
    s.add(sampleFavorite())
    const raw = localStorage.getItem(STORAGE_KEYS.favorites)
    expect(raw).toBeTruthy()
    const saved = JSON.parse(raw!) as FavoriteItem[]
    expect(saved).toHaveLength(1)
    expect(saved[0]?.vod.id).toBe('v1')
  })
})
