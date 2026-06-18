import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FIVE_DAYS_MS } from '../utils/time'
import { useHistoryStore } from './history'

function sampleVod() {
  return { id: 'v1', sourceId: 's1', name: '影片A', pic: 'https://x.com/a.jpg' }
}

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

describe('useHistoryStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    setActivePinia(createPinia())
  })

  it('touch 新增记录', () => {
    const s = useHistoryStore()
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 0 })
    expect(s.items).toHaveLength(1)
    expect(s.items[0]?.vod.id).toBe('v1')
    expect(s.items[0]?.progress).toBe(0)
  })

  it('touch 同一 key 更新时间与进度', async () => {
    const s = useHistoryStore()
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 10 })
    const firstTime = s.items[0]!.lastWatchTime
    await new Promise((r) => setTimeout(r, 10))
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 20 })
    expect(s.items).toHaveLength(1)
    expect(s.items[0]?.progress).toBe(20)
    expect(s.items[0]?.lastWatchTime).toBeGreaterThan(firstTime)
  })

  it('touch 不同 episode 新增记录', () => {
    const s = useHistoryStore()
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 0 })
    s.touch({
      sourceId: 's1',
      vod: sampleVod(),
      episode: { name: '第2集', url: 'https://x.com/2.m3u8' },
      progress: 0,
    })
    expect(s.items).toHaveLength(2)
  })

  it('remove 删除指定记录', () => {
    const s = useHistoryStore()
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 0 })
    const id = s.items[0]!.id
    s.remove(id)
    expect(s.items).toHaveLength(0)
  })

  it('clear 清空', () => {
    const s = useHistoryStore()
    s.touch({ sourceId: 's1', vod: sampleVod(), progress: 0 })
    s.clear()
    expect(s.items).toHaveLength(0)
  })

  it('cleanup 删除过期项', () => {
    const s = useHistoryStore()
    const old = Date.now() - FIVE_DAYS_MS - 1000
    s.items = [
      { id: 'a', sourceId: 's1', vod: sampleVod(), lastWatchTime: old, progress: 0 },
      { id: 'b', sourceId: 's1', vod: { ...sampleVod(), id: 'v2' }, lastWatchTime: Date.now(), progress: 0 },
    ]
    s.cleanup()
    expect(s.items).toHaveLength(1)
    expect(s.items[0]?.id).toBe('b')
  })

  it('cleanup 无过期时不持久化', () => {
    const s = useHistoryStore()
    s.items = [{ id: 'a', sourceId: 's1', vod: sampleVod(), lastWatchTime: Date.now(), progress: 0 }]
    s.cleanup()
    expect(s.items).toHaveLength(1)
    expect(localStorage.getItem('hplayer:history')).toBeNull()
  })
})
