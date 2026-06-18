import { beforeEach, describe, expect, it } from 'vitest'
import { getUAPool, nextUA, setDeviceType, UAPool } from './ua-pool'

describe('UAPool', () => {
  let pool: UAPool

  beforeEach(() => {
    pool = new UAPool(3, 'mobile')
  })

  it('next() 返回字符串 UA', () => {
    const ua = pool.next()
    expect(typeof ua).toBe('string')
    expect(ua.length).toBeGreaterThan(0)
  })

  it('next() 在池内轮询不重复（直到 N 次）', () => {
    const set = new Set<string>()
    for (let i = 0; i < 3; i++) {
      set.add(pool.next())
    }
    expect(set.size).toBe(3)
  })

  it('next() 超过池大小后回环（可能出现重复）', () => {
    const first = pool.next()
    // 6 次后（2 * 3）应回到第一个
    for (let i = 0; i < 5; i++) pool.next()
    const sixth = pool.next()
    expect(sixth).toBe(first)
  })

  it('length 返回池大小', () => {
    expect(pool.length).toBe(3)
  })

  it('reset 重建池', () => {
    const old1 = pool.next()
    const old2 = pool.next()
    const old3 = pool.next()
    pool.reset(2, 'desktop')
    expect(pool.length).toBe(2)
    // 池重建后 idx 归 0，next 应该是新池的某项
    const new1 = pool.next()
    expect([old1, old2, old3]).not.toContain(new1)
  })

  it('不同 deviceType 生成不同形态的 UA', () => {
    const mobilePool = new UAPool(2, 'mobile')
    const desktopPool = new UAPool(2, 'desktop')
    const mobileUA = mobilePool.next()
    const desktopUA = desktopPool.next()
    // mobile 应包含 iPhone/Android 关键字，desktop 应包含 Windows/Mac/Linux
    expect(/iPhone|Android/.test(mobileUA)).toBe(true)
    expect(/Windows NT|Macintosh|X11/.test(desktopUA)).toBe(true)
  })
})

describe('全局 UA 池', () => {
  beforeEach(() => {
    // 重置单例
    setDeviceType('mobile')
  })

  it('getUAPool 返回单例', () => {
    const a = getUAPool()
    const b = getUAPool()
    expect(a).toBe(b)
  })

  it('nextUA 返回有效 UA', () => {
    const ua = nextUA()
    expect(typeof ua).toBe('string')
    expect(ua.length).toBeGreaterThan(20)
  })

  it('setDeviceType 切换后 UA 池类型变更', () => {
    setDeviceType('mobile')
    const before = nextUA()
    setDeviceType('desktop')
    const after = nextUA()
    expect(/iPhone|Android/.test(before)).toBe(true)
    expect(/Windows NT|Macintosh|X11/.test(after)).toBe(true)
  })
})
