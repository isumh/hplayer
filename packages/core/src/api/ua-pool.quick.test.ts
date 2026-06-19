import { describe, expect, it } from 'vitest'
import { nextUA } from './ua-pool'

describe('ua-pool quick', () => {
  it('nextUA should return string', () => {
    const ua = nextUA()
    console.log('ua:', ua)
    expect(typeof ua).toBe('string')
    expect(ua.length).toBeGreaterThan(0)
  })
})
