import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoSource } from '../types/source'
import { adapterProxy, clearAdapterCache, getAdapter } from './index'
import { T0XmlAdapter } from './t0-xml'
import { T1JsonAdapter } from './t1-json'

const t1Source: VideoSource = {
  id: 's1',
  name: 'json-source',
  type: 't1_json',
  baseUrl: 'https://json.example',
  pageSize: 20,
  enabled: true,
  createdAt: 0,
  order: 0,
}

const t0Source: VideoSource = {
  id: 's0',
  name: 'xml-source',
  type: 't0_xml',
  baseUrl: 'https://xml.example',
  pageSize: 20,
  enabled: true,
  createdAt: 0,
  order: 0,
}

describe('adapter/index', () => {
  beforeEach(() => {
    clearAdapterCache()
    vi.clearAllMocks()
  })

  it('getAdapter 返回对应类型实例', () => {
    const a1 = getAdapter(t1Source)
    expect(a1).toBeInstanceOf(T1JsonAdapter)
    expect(a1.type).toBe('t1_json')

    const a0 = getAdapter(t0Source)
    expect(a0).toBeInstanceOf(T0XmlAdapter)
    expect(a0.type).toBe('t0_xml')
  })

  it('getAdapter 缓存实例', () => {
    const a = getAdapter(t1Source)
    const b = getAdapter(t1Source)
    expect(a).toBe(b)
  })

  it('getAdapter 重新 init 会更新配置', () => {
    const a = getAdapter(t1Source)
    const b = getAdapter({ ...t1Source, baseUrl: 'https://json2.example' })
    expect(a).toBe(b)
  })
})

describe('adapterProxy', () => {
  beforeEach(() => {
    clearAdapterCache()
    vi.clearAllMocks()
  })

  it('getCategories 代理到适配器', async () => {
    const a = getAdapter(t1Source)
    vi.spyOn(a, 'getCategories').mockResolvedValueOnce([{ id: '1', name: '电影', sourceId: '' }])
    const res = await adapterProxy.getCategories(t1Source)
    expect(res).toEqual([{ id: '1', name: '电影', sourceId: '' }])
  })

  it('getList 返回的 sourceId 被替换为源 id', async () => {
    const a = getAdapter(t1Source)
    vi.spyOn(a, 'getList').mockResolvedValueOnce({
      list: [{ id: 'v1', sourceId: '', name: '影片', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })
    const res = await adapterProxy.getList(t1Source, { categoryId: 1, page: 1 })
    expect(res.list[0]?.sourceId).toBe('s1')
  })

  it('getDetail 返回的 sourceId 被替换为源 id', async () => {
    const a = getAdapter(t1Source)
    vi.spyOn(a, 'getDetail').mockResolvedValueOnce({
      id: 'v1',
      sourceId: '',
      name: '影片',
      pic: '',
      playFrom: [],
      playList: {},
    })
    const res = await adapterProxy.getDetail(t1Source, 'v1')
    expect(res.sourceId).toBe('s1')
  })

  it('search 返回的 sourceId 被替换为源 id', async () => {
    const a = getAdapter(t1Source)
    vi.spyOn(a, 'search').mockResolvedValueOnce({
      list: [{ id: 'v1', sourceId: '', name: '影片', pic: '' }],
      total: 1,
      pageCount: 1,
      currentPage: 1,
    })
    const res = await adapterProxy.search(t1Source, { keyword: '影片', page: 1 })
    expect(res.list[0]?.sourceId).toBe('s1')
  })
})
