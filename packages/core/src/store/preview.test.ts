import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePreviewStore } from './preview'

describe('usePreviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('open 设置图片与起始索引', () => {
    const s = usePreviewStore()
    s.open(['a.jpg', 'b.jpg'], 1)
    expect(s.show).toBe(true)
    expect(s.images).toEqual(['a.jpg', 'b.jpg'])
    expect(s.startIndex).toBe(1)
  })

  it('close 关闭预览', () => {
    const s = usePreviewStore()
    s.open(['a.jpg'])
    s.close()
    expect(s.show).toBe(false)
  })

  it('open 默认起始索引为 0', () => {
    const s = usePreviewStore()
    s.open(['a.jpg', 'b.jpg'])
    expect(s.startIndex).toBe(0)
  })

  it('不持久化到 localStorage', () => {
    const s = usePreviewStore()
    s.open(['a.jpg'])
    expect(localStorage.length).toBe(0)
  })
})
