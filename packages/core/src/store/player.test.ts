import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePlayerStore } from './player'

function sampleVod() {
  return {
    id: 'v1',
    sourceId: 's1',
    name: '影片A',
    pic: 'https://x.com/a.jpg',
  }
}

describe('usePlayerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setCurrent 设置当前播放', () => {
    const s = usePlayerStore()
    const vod = sampleVod()
    s.setCurrent({ vod, sourceId: 's1' })
    expect(s.current).not.toBeNull()
    expect(s.current?.vod.id).toBe('v1')
    expect(s.current?.sourceId).toBe('s1')
  })

  it('clear 清空当前播放', () => {
    const s = usePlayerStore()
    s.setCurrent({ vod: sampleVod(), sourceId: 's1' })
    s.clear()
    expect(s.current).toBeNull()
  })

  it('不持久化到 localStorage', () => {
    const s = usePlayerStore()
    s.setCurrent({ vod: sampleVod(), sourceId: 's1' })
    expect(localStorage.length).toBe(0)
  })
})
