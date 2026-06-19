import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adapterProxy } from './index'
import { aggregateSearch } from './aggregate'

vi.mock('./index', () => ({
  adapterProxy: {
    search: vi.fn(),
  },
}))

function mockSource(id: string, name: string, enabled = true) {
  return {
    id,
    name,
    type: 't1_json' as const,
    baseUrl: `http://${id}.test`,
    pageSize: 20,
    enabled,
    createdAt: 0,
    order: 0,
  }
}

describe('aggregateSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('并发搜索所有 enabled 源并合并结果', async () => {
    const s1 = mockSource('s1', '源A')
    const s2 = mockSource('s2', '源B')
    const mocked = vi.mocked(adapterProxy.search)
    mocked.mockResolvedValueOnce({
      list: [{ id: '1', sourceId: 's1', name: '影片1', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })
    mocked.mockResolvedValueOnce({
      list: [{ id: '2', sourceId: 's2', name: '影片2', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })

    const res = await aggregateSearch([s1, s2], { keyword: 'kw', page: 1, pageSize: 10 })
    expect(res.list).toHaveLength(2)
    expect(res.list[0]?.sourceName).toBe('源A')
    expect(res.list[1]?.sourceName).toBe('源B')
    expect(res.errors).toHaveLength(0)
  })

  it('单源失败不影响整体并记录错误', async () => {
    const s1 = mockSource('s1', '源A')
    const s2 = mockSource('s2', '源B')
    const mocked = vi.mocked(adapterProxy.search)
    mocked.mockResolvedValueOnce({
      list: [{ id: '1', sourceId: 's1', name: '影片1', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })
    mocked.mockRejectedValueOnce(new Error('timeout'))

    const res = await aggregateSearch([s1, s2], { keyword: 'kw' })
    expect(res.list).toHaveLength(1)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]?.sourceId).toBe('s2')
    expect(res.errors[0]?.error).toBe('timeout')
  })

  it('跳过 disabled 源', async () => {
    const s1 = mockSource('s1', '源A', true)
    const s2 = mockSource('s2', '源B', false)
    const mocked = vi.mocked(adapterProxy.search)
    mocked.mockResolvedValueOnce({
      list: [{ id: '1', sourceId: 's1', name: '影片1', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })

    const res = await aggregateSearch([s1, s2], { keyword: 'kw' })
    expect(res.list).toHaveLength(1)
    expect(mocked).toHaveBeenCalledTimes(1)
  })

  it('pageSize 未传时不加入参数', async () => {
    const s1 = mockSource('s1', '源A')
    const mocked = vi.mocked(adapterProxy.search)
    mocked.mockResolvedValueOnce({ list: [], total: 0, pageCount: 0, currentPage: 1 })

    await aggregateSearch([s1], { keyword: 'kw' })
    expect(mocked).toHaveBeenCalledWith(s1, { keyword: 'kw', page: 1 })
  })
})
