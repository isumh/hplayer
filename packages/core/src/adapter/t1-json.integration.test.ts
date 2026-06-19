import { beforeEach, describe, expect, it, vi } from 'vitest'
import { T1JsonAdapter } from './t1-json'

vi.mock('../api/client', () => ({
  http: {
    get: vi.fn(),
  },
}))

import { http } from '../api/client'

const httpGet = http.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

const baseSource = {
  id: 's',
  name: 't',
  type: 't1_json' as const,
  baseUrl: 'https://x.com',
  pageSize: 20,
  enabled: true,
  createdAt: 0,
  order: 0,
}

describe('T1JsonAdapter getList', () => {
  it('解析 mac-cms JSON 响应', async () => {
    httpGet.mockResolvedValueOnce({
      data: {
        code: 1,
        page: 1,
        pagecount: 5,
        total: 100,
        list: [
          {
            vod_id: 1,
            vod_name: '示例',
            vod_pic: 'https://x.com/a.jpg',
            vod_remarks: '更新至 12 集',
            vod_year: '2024',
          },
        ],
      },
    })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const res = await a.getList({ categoryId: 1, page: 1 })
    expect(res.list).toHaveLength(1)
    expect(res.list[0]?.name).toBe('示例')
    expect(res.list[0]?.pic).toBe('https://x.com/a.jpg')
    expect(res.list[0]?.year).toBe('2024')
    expect(res.pageCount).toBe(5)
    expect(res.total).toBe(100)
    expect(res.currentPage).toBe(1)
  })

  it('空 list 返回空数组而非抛错', async () => {
    httpGet.mockResolvedValueOnce({
      data: { code: 1, page: 1, pagecount: 0, total: 0, list: [] },
    })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const res = await a.getList({ categoryId: 1, page: 1 })
    expect(res.list).toEqual([])
    expect(res.total).toBe(0)
  })

  it('list 字段缺失时降级为空数组', async () => {
    httpGet.mockResolvedValueOnce({ data: { code: 1 } })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const res = await a.getList({ categoryId: 1, page: 1 })
    expect(res.list).toEqual([])
  })

  it('使用 baseUrl 拼接查询参数', async () => {
    httpGet.mockResolvedValueOnce({
      data: { code: 1, list: [] },
    })
    const a = new T1JsonAdapter()
    a.init({ ...baseSource, baseUrl: 'https://x.com/api/' })
    await a.getList({ categoryId: 5, page: 2, pageSize: 30 })
    expect(httpGet).toHaveBeenCalledTimes(1)
    const [url] = httpGet.mock.calls[0] as [string]
    expect(url).toMatch(/^https:\/\/x\.com\/api\?/)
    expect(url).toContain('ac=videolist')
    expect(url).toContain('t=5')
    expect(url).toContain('pg=2')
    expect(url).toContain('pagesize=30')
  })
})

describe('T1JsonAdapter getDetail', () => {
  it('解析详情并切分 playFrom/playUrl', async () => {
    httpGet.mockResolvedValueOnce({
      data: {
        code: 1,
        list: [
          {
            vod_id: 1,
            vod_name: '详情剧',
            vod_pic: 'https://x.com/d.jpg',
            vod_play_from: '线路1$$$线路2',
            vod_play_url: '第1集$https://x.com/url1#第2集$https://x.com/url2$$$第1集$https://x.com/url3',
          },
        ],
      },
    })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const res = await a.getDetail(1)
    expect(res.name).toBe('详情剧')
    expect(res.playFrom).toHaveLength(2)
    expect(res.playFrom[0]?.name).toBe('线路1')
    expect(res.playFrom[1]?.name).toBe('线路2')
    expect(res.playList['线路1']).toHaveLength(2)
    expect(res.playList['线路1']?.[0]?.url).toBe('https://x.com/url1')
    expect(res.playList['线路2']?.[0]?.url).toBe('https://x.com/url3')
  })

  it('空 list 抛错', async () => {
    httpGet.mockResolvedValueOnce({ data: { code: 1, list: [] } })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    await expect(a.getDetail(999)).rejects.toThrow('detail not found')
  })
})

describe('T1JsonAdapter getCategories', () => {
  it('解析 class 字段', async () => {
    httpGet.mockResolvedValueOnce({
      data: {
        class: [
          { type_id: 1, type_name: '电影' },
          { type_id: 2, type_name: '剧集' },
        ],
      },
    })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const cats = await a.getCategories()
    expect(cats).toHaveLength(2)
    expect(cats[0]?.name).toBe('电影')
    expect(cats[1]?.id).toBe('2')
  })

  it('缺 class 字段返回空数组', async () => {
    httpGet.mockResolvedValueOnce({ data: {} })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const cats = await a.getCategories()
    expect(cats).toEqual([])
  })
})

describe('T1JsonAdapter search', () => {
  it('搜索参数走 wd 字段', async () => {
    httpGet.mockResolvedValueOnce({
      data: {
        code: 1,
        page: 1,
        pagecount: 1,
        total: 1,
        list: [{ vod_id: 7, vod_name: '匹配', vod_pic: '' }],
      },
    })
    const a = new T1JsonAdapter()
    a.init(baseSource)
    const res = await a.search({ keyword: '关键字', page: 1 })
    const [url] = httpGet.mock.calls[0] as [string]
    expect(url).toContain('wd=')
    expect(res.list[0]?.name).toBe('匹配')
  })
})
