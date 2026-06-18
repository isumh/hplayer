import { describe, expect, it } from 'vitest'
import type { VideoSource } from '../types/source'
import { T1JsonAdapter } from './t1-json'

const source: VideoSource = {
  id: 'src-1',
  name: 'test',
  type: 't1_json',
  baseUrl: 'https://example.com/api.php/provide/vod',
  pageSize: 20,
  enabled: true,
  createdAt: 0,
  order: 0,
}

describe('T1JsonAdapter init', () => {
  it('去除 baseUrl 尾部斜杠', () => {
    const a = new T1JsonAdapter()
    a.init({ ...source, baseUrl: 'https://example.com/api.php/provide/vod/' })
    // 内部字段私有，通过反射检查
    expect((a as unknown as { baseUrl: string }).baseUrl).toBe(
      'https://example.com/api.php/provide/vod',
    )
  })
  it('pageSize 缺省 20', () => {
    const a = new T1JsonAdapter()
    const s: VideoSource = { ...source }
    delete s.pageSize
    a.init(s)
    expect((a as unknown as { defaultPageSize: number }).defaultPageSize).toBe(20)
  })
  it('pageSize 越界约束', () => {
    const a = new T1JsonAdapter()
    a.init({ ...source, pageSize: 200 })
    expect((a as unknown as { defaultPageSize: number }).defaultPageSize).toBe(100)
  })
})
