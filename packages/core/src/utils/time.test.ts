import { describe, expect, it } from 'vitest'
import { FIVE_DAYS_MS, isExpired } from './time'

describe('isExpired', () => {
  const now = 1_700_000_000_000
  it('5 天前已过期', () => {
    expect(isExpired(now - FIVE_DAYS_MS - 1, now)).toBe(true)
  })
  it('4 天前未过期', () => {
    expect(isExpired(now - 4 * 24 * 60 * 60 * 1000, now)).toBe(false)
  })
  it('当前未过期', () => {
    expect(isExpired(now, now)).toBe(false)
  })
})
