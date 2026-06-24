import { describe, expect, it } from 'vitest'
import type { Category } from '../types/vod'
import { filterCategoriesByReserved, parseReservedCategories } from './category-filter'

const cats: Category[] = [
  { id: '1', name: '电影', sourceId: 's1' },
  { id: '2', name: '电视剧', sourceId: 's1' },
  { id: '3', name: '足球', sourceId: 's1' },
  { id: '4', name: '篮球', sourceId: 's1' },
  { id: '5', name: 'Movie', sourceId: 's1' },
]

describe('parseReservedCategories', () => {
  it('空 / null / undefined 返回空数组', () => {
    expect(parseReservedCategories('')).toEqual([])
    expect(parseReservedCategories(null)).toEqual([])
    expect(parseReservedCategories(undefined)).toEqual([])
  })

  it('解析单个名称', () => {
    expect(parseReservedCategories('电影')).toEqual(['电影'])
  })

  it('解析多个空格分隔的名称', () => {
    expect(parseReservedCategories('电影 足球')).toEqual(['电影', '足球'])
  })

  it('多个连续空白也正确拆分', () => {
    expect(parseReservedCategories('  电影   足球  \t 篮球  ')).toEqual(['电影', '足球', '篮球'])
  })

  it('去重（大小写不敏感），保留首次出现的大小写', () => {
    expect(parseReservedCategories('电影 电影 MOVIE movie')).toEqual(['电影', 'MOVIE'])
  })

  it('过滤空串（仅空白时返回空数组）', () => {
    expect(parseReservedCategories('   ')).toEqual([])
  })
})

describe('filterCategoriesByReserved', () => {
  it('reserved 为空 / 未配置时返回原列表', () => {
    expect(filterCategoriesByReserved(cats, undefined)).toBe(cats)
    expect(filterCategoriesByReserved(cats, null)).toBe(cats)
    expect(filterCategoriesByReserved(cats, [])).toBe(cats)
  })

  it('按名称精确匹配（大小写不敏感）', () => {
    const result = filterCategoriesByReserved(cats, ['电影', '足球'])
    expect(result.map((c) => c.id)).toEqual(['1', '3'])
  })

  it('按 reserved 列表顺序输出（覆盖源分类顺序）', () => {
    // 源中 电影 在前、篮球 在后；reserved 顺序反过来 → 结果应按 reserved 顺序
    const result = filterCategoriesByReserved(cats, ['篮球', '电影'])
    expect(result.map((c) => c.name)).toEqual(['篮球', '电影'])
  })

  it('reserved 中部分名称在源中不存在时仅返回命中项，按 reserved 顺序', () => {
    // 源里没有"动作片"和"也没有"；仅"足球"命中
    const result = filterCategoriesByReserved(cats, ['动作片', '足球', '也没有'])
    expect(result.map((c) => c.name)).toEqual(['足球'])
  })

  it('reserved 中没有匹配项时返回空数组（交由调用方走"全部"分支）', () => {
    expect(filterCategoriesByReserved(cats, ['不存在'])).toEqual([])
  })

  it('匹配大小写不同的同名分类', () => {
    const result = filterCategoriesByReserved(cats, ['movie'])
    expect(result.map((c) => c.id)).toEqual(['5'])
  })

  it('reserved 中的大小写不影响匹配', () => {
    const result = filterCategoriesByReserved(cats, ['MOVIE', '电影'])
    expect(result.map((c) => c.id)).toEqual(['5', '1'])
  })

  it('源中同名重复时结果只取首个', () => {
    const duped: Category[] = [
      { id: 'a', name: '电影', sourceId: 's1' },
      { id: 'b', name: '电影', sourceId: 's1' },
      { id: 'c', name: '足球', sourceId: 's1' },
    ]
    const result = filterCategoriesByReserved(duped, ['电影', '足球'])
    expect(result.map((c) => c.id)).toEqual(['a', 'c'])
  })
})
