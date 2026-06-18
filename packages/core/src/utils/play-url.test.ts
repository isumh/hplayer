import { describe, expect, it } from 'vitest'
import { detectProtocol } from './play-url'

describe('detectProtocol', () => {
  it('识别 hls', () => expect(detectProtocol('https://a.com/index.m3u8')).toBe('hls'))
  it('识别 flv', () => expect(detectProtocol('https://a.com/live.flv')).toBe('flv'))
  it('识别 mp4', () => expect(detectProtocol('https://a.com/x.mp4')).toBe('mp4'))
  it('未知协议', () => expect(detectProtocol('https://a.com/abc')).toBe('unknown'))
})
