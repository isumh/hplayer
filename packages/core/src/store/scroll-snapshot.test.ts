import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCROLL_SNAPSHOT_TTL_MS, useScrollSnapshotStore } from './scroll-snapshot'

describe('useScrollSnapshotStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('save 后 take 可取出原始快照', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 0 })
    const got = s.take('home')
    expect(got).toEqual({ items: [], page: 1, finished: false, scrollTop: 0 })
  })

  it('take 不删除快照（可多次取出）', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 100 })
    expect(s.take('home')?.scrollTop).toBe(100)
    expect(s.take('home')?.scrollTop).toBe(100)
  })

  it('take 不存在的 key 返回 null', () => {
    const s = useScrollSnapshotStore()
    expect(s.take('nope')).toBeNull()
  })

  it('clear 删除指定 key', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 50 })
    s.clear('home')
    expect(s.take('home')).toBeNull()
  })

  it('clear 不存在的 key 不抛错', () => {
    const s = useScrollSnapshotStore()
    expect(() => s.clear('nope')).not.toThrow()
  })

  it('clearAll 清空所有快照', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 0 })
    s.save('search?keyword=foo&mode=single', {
      items: [],
      page: 1,
      finished: false,
      scrollTop: 200,
      keyword: 'foo',
      mode: 'single',
    })
    s.clearAll()
    expect(s.take('home')).toBeNull()
    expect(s.take('search?keyword=foo&mode=single')).toBeNull()
  })

  it('不同 key 的快照相互隔离', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 10 })
    s.save('search?keyword=x', { items: [], page: 1, finished: false, scrollTop: 99, keyword: 'x' })
    expect(s.take('home')?.scrollTop).toBe(10)
    expect(s.take('search?keyword=x')?.scrollTop).toBe(99)
  })

  it('TTL 过期后 take 返回 null 并惰性删除', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 5 })
    // 模拟时间前进
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + SCROLL_SNAPSHOT_TTL_MS + 1)
    expect(s.take('home')).toBeNull()
    // 再次 take 也应返回 null（已被惰性删除）
    expect(s.take('home')).toBeNull()
    nowSpy.mockRestore()
  })

  it('未到 TTL 的快照仍可取出', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 5 })
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + SCROLL_SNAPSHOT_TTL_MS - 1000)
    expect(s.take('home')?.scrollTop).toBe(5)
    nowSpy.mockRestore()
  })

  it('save 会覆盖同 key 的旧快照', () => {
    const s = useScrollSnapshotStore()
    s.save('home', { items: [], page: 1, finished: false, scrollTop: 10 })
    s.save('home', { items: [], page: 2, finished: false, scrollTop: 99 })
    expect(s.take('home')?.scrollTop).toBe(99)
    expect(s.take('home')?.page).toBe(2)
  })
})
