// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { T0XmlAdapter } from './t0-xml'

describe('T0XmlAdapter with real dytt source', () => {
  // 真实网络源响应较慢，统一放宽超时
  const TEST_TIMEOUT = 30_000
  const source = {
    id: 'dytt_xml',
    name: '电影天堂 XML',
    type: 't0_xml' as const,
    baseUrl: 'http://caiji.dyttzyapi.com/api.php/provide/vod/from/dytt/at/xml/',
    pageSize: 20,
    enabled: true,
    createdAt: Date.now(),
    order: 0,
  }

  it('should fetch categories', async () => {
    const adapter = new T0XmlAdapter()
    adapter.init(source)
    const categories = await adapter.getCategories()
    console.log('categories count:', categories.length)
    console.log('first 3 categories:', categories.slice(0, 3))
    expect(categories.length).toBeGreaterThan(0)
    expect(categories[0]).toHaveProperty('id')
    expect(categories[0]).toHaveProperty('name')
  }, TEST_TIMEOUT)

  it('should fetch list for first category', async () => {
    const adapter = new T0XmlAdapter()
    adapter.init(source)
    const categories = await adapter.getCategories()
    // 电影天堂 XML 源的一级分类（如 1 电影片）没有直接数据，
    // 需要使用有数据的子分类（如 30 日韩动漫、6 动作片）
    const target = categories.find((c) => ['6', '7', '8', '30'].includes(c.id)) ?? categories[0]
    const list = await adapter.getList({ categoryId: target.id, page: 1, pageSize: 10 })
    console.log('category id:', target.id, 'list total:', list.total)
    console.log('list items count:', list.list.length)
    console.log('first item:', list.list[0])
    expect(list.list.length).toBeGreaterThan(0)
    expect(list.list[0]).toHaveProperty('id')
    expect(list.list[0]).toHaveProperty('name')
  }, TEST_TIMEOUT)

  it('should fetch detail for first item', async () => {
    const adapter = new T0XmlAdapter()
    adapter.init(source)
    const categories = await adapter.getCategories()
    const target = categories.find((c) => ['6', '7', '8', '30'].includes(c.id)) ?? categories[0]
    const list = await adapter.getList({ categoryId: target.id, page: 1, pageSize: 1 })
    const firstItem = list.list[0]
    if (!firstItem) {
      throw new Error('未找到可测试的影片')
    }
    const detail = await adapter.getDetail(firstItem.id)
    console.log('detail name:', detail.name)
    console.log('detail playFrom count:', detail.playFrom?.length)
    console.log('detail playList keys:', Object.keys(detail.playList || {}))
    expect(detail.id).toBe(firstItem.id)
    expect(detail.name).toBeTruthy()
  }, TEST_TIMEOUT)
})
