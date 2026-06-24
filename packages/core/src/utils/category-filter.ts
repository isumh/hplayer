import type { Category } from '../types/vod'

/**
 * 解析空格分隔的"保留分类"字符串为去重后的名称数组。
 * - 自动 trim 空白
 * - 过滤空串
 * - 去重（大小写不敏感，保留首次出现的大小写）
 */
export function parseReservedCategories(input: string | undefined | null): string[] {
  if (!input) return []
  const seen = new Set<string>()
  const result: string[] = []
  // 用 \s+ 拆分：覆盖连续空格、Tab、换行等空白字符
  for (const raw of input.split(/\s+/)) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }
  return result
}

/**
 * 按"保留分类"过滤分类列表（按名称不区分大小写精确匹配）。
 * reserved 为空 / 未配置时返回原列表（保持现有行为）。
 */
export function filterCategoriesByReserved(
  categories: Category[],
  reserved: string[] | undefined | null,
): Category[] {
  if (!reserved || reserved.length === 0) return categories
  const set = new Set(reserved.map((n) => n.toLowerCase()))
  return categories.filter((c) => set.has(c.name.toLowerCase()))
}
