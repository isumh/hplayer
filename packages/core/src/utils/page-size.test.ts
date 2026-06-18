import { describe, expect, it } from 'vitest'
import { clampPageSize } from './page-size'

describe('clampPageSize', () => {
  it('缺省时返回 fallback', () => expect(clampPageSize(undefined)).toBe(20))
  it('小于 1 时返回 1', () => expect(clampPageSize(0)).toBe(1))
  it('大于 100 时返回 100', () => expect(clampPageSize(101)).toBe(100))
  it('正常值原样返回', () => expect(clampPageSize(30)).toBe(30))
  it('小数取整', () => expect(clampPageSize(20.7)).toBe(20))
  it('null 走 fallback', () => expect(clampPageSize(null)).toBe(20))
})
