import { describe, expect, it } from 'vitest'
import { normalizeImageUrl } from './image-url'

describe('normalizeImageUrl', () => {
  it('空字符串原样返回', () => expect(normalizeImageUrl('')).toBe(''))
  it('未开启 forceHttps 时 http URL 原样返回', () =>
    expect(normalizeImageUrl('http://example.com/a.jpg')).toBe('http://example.com/a.jpg'))
  it('开启 forceHttps 时 http 替换为 https', () =>
    expect(normalizeImageUrl('http://example.com/a.jpg', true)).toBe('https://example.com/a.jpg'))
  it('开启 forceHttps 时 https 不受影响', () =>
    expect(normalizeImageUrl('https://example.com/a.jpg', true)).toBe('https://example.com/a.jpg'))
  it('开启 forceHttps 时只替换开头的 http://', () =>
    expect(normalizeImageUrl('http://http.com/http.jpg', true)).toBe('https://http.com/http.jpg'))
})
