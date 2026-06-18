import { describe, expect, it } from 'vitest'
import { LruCache } from './lru'

describe('LruCache', () => {
  it('容量 0 抛错', () => {
    expect(() => new LruCache<string, number>(0)).toThrow()
  })
  it('get/set 正常', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    expect(c.get('a')).toBe(1)
  })
  it('容量满时淘汰最早', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.set('c', 3)
    expect(c.get('a')).toBeUndefined()
    expect(c.get('b')).toBe(2)
    expect(c.get('c')).toBe(3)
  })
  it('命中后刷新顺序', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.get('a')
    c.set('c', 3)
    expect(c.get('a')).toBe(1)
    expect(c.get('b')).toBeUndefined()
  })
})
