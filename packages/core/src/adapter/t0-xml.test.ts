import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '../api/client'
import { T0XmlAdapter } from './t0-xml'

vi.mock('../api/client', () => ({
  http: {
    get: vi.fn(),
  },
}))

function createAdapter(): T0XmlAdapter {
  const a = new T0XmlAdapter()
  a.init({
    id: 's0',
    name: 'xml-source',
    type: 't0_xml',
    baseUrl: 'https://xml.example',
    pageSize: 20,
    enabled: true,
    createdAt: 0,
    order: 0,
  })
  return a
}

function mockGet(xml: string) {
  ;(http.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: xml,
  })
}

function buildListXml(overrides?: { video?: string; page?: number; pagecount?: number; recordcount?: number }): string {
  const video =
    overrides?.video ??
    `
    <video>
      <id>123</id>
      <name>示例影片</name>
      <pic>https://x.com/a.jpg</pic>
      <type>剧情</type>
      <year>2024</year>
      <area>大陆</area>
      <actor>演员A</actor>
      <director>导演B</director>
      <des>剧情简介</des>
      <note>更新至 12 集</note>
    </video>
  `
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list page="${overrides?.page ?? 1}" pagecount="${overrides?.pagecount ?? 5}" recordcount="${overrides?.recordcount ?? 100}">
    ${video}
  </list>
</rss>`
}

describe('T0XmlAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('解析分类列表', async () => {
    mockGet(`<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <class>
    <ty id="1">电影</ty>
    <ty id="2">电视剧</ty>
  </class>
</rss>`)
    const a = createAdapter()
    const cats = await a.getCategories()
    expect(cats).toHaveLength(2)
    expect(cats[0]).toEqual({ id: '1', name: '电影', sourceId: '' })
    expect(cats[1]).toEqual({ id: '2', name: '电视剧', sourceId: '' })
    expect(http.get).toHaveBeenCalledWith(
      'https://xml.example?ac=list',
      expect.objectContaining({ responseType: 'text' }),
    )
  })

  it('解析视频列表', async () => {
    mockGet(buildListXml())
    const a = createAdapter()
    const res = await a.getList({ categoryId: 1, page: 1 })
    expect(res.currentPage).toBe(1)
    expect(res.pageCount).toBe(5)
    expect(res.total).toBe(100)
    expect(res.list).toHaveLength(1)
    const first = res.list[0]
    expect(first?.id).toBe('123')
    expect(first?.name).toBe('示例影片')
    expect(first?.pic).toBe('https://x.com/a.jpg')
    expect(first?.type).toBe('剧情')
    expect(first?.year).toBe('2024')
    expect(first?.area).toBe('大陆')
    expect(first?.actor).toBe('演员A')
    expect(first?.director).toBe('导演B')
    expect(first?.desc).toBe('剧情简介')
    expect(first?.remarks).toBe('更新至 12 集')
  })

  it('解析详情与选集', async () => {
    mockGet(`<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list>
    <video>
      <id>123</id>
      <name>示例影片</name>
      <pic>https://x.com/a.jpg</pic>
      <dl>
        <dd flag="线路1">第1集$https://x.com/1.m3u8#第2集$https://x.com/2.m3u8</dd>
        <dd flag="线路2">HD$https://x.com/hd.m3u8</dd>
      </dl>
    </video>
  </list>
</rss>`)
    const a = createAdapter()
    const detail = await a.getDetail(123)
    expect(detail.playFrom).toEqual([{ name: '线路1' }, { name: '线路2' }])
    expect(detail.playList['线路1']).toEqual([
      { name: '第1集', url: 'https://x.com/1.m3u8' },
      { name: '第2集', url: 'https://x.com/2.m3u8' },
    ])
    expect(detail.playList['线路2']).toEqual([{ name: 'HD', url: 'https://x.com/hd.m3u8' }])
  })

  it('解析搜索', async () => {
    mockGet(buildListXml({ video: '<video><id>456</id><name>搜索影片</name><pic>https://x.com/b.jpg</pic></video>' }))
    const a = createAdapter()
    const res = await a.search({ keyword: '搜索', page: 1 })
    expect(res.list).toHaveLength(1)
    expect(res.list[0]?.id).toBe('456')
    expect(res.list[0]?.name).toBe('搜索影片')
    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining('wd=%E6%90%9C%E7%B4%A2'),
      expect.objectContaining({ responseType: 'text' }),
    )
  })

  it('字段缺失时兜底', async () => {
    mockGet(`<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list>
    <video>
      <id>789</id>
      <name>极简影片</name>
      <pic>https://x.com/c.jpg</pic>
    </video>
  </list>
</rss>`)
    const a = createAdapter()
    const res = await a.getList({ categoryId: 1, page: 1 })
    const first = res.list[0]
    expect(first?.id).toBe('789')
    expect(first?.name).toBe('极简影片')
    expect(first?.year).toBeUndefined()
    expect(first?.desc).toBeUndefined()
  })

  it('XML 解析失败返回空列表', async () => {
    mockGet('<invalid>')
    const a = createAdapter()
    const res = await a.getList({ categoryId: 1, page: 1 })
    expect(res.list).toHaveLength(0)
    expect(res.total).toBe(0)
  })

  it('详情为空时抛出错误', async () => {
    mockGet(`<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1"><list></list></rss>`)
    const a = createAdapter()
    await expect(a.getDetail(123)).rejects.toThrow('T0_XML 详情返回为空')
  })
})
