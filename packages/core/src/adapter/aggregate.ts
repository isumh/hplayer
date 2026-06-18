import type { VideoSource } from '../types/source'
import type { ListPage, VodItem } from '../types/vod'
import { adapterProxy } from './index'

export interface AggregateSearchResult {
  list: (VodItem & { sourceName: string })[]
  errors: { sourceId: string; sourceName: string; error: string }[]
}

/**
 * 聚合搜索（用户决策 #16 确认）：并发请求所有 enabled 源，结果合并。
 * 单源失败不影响整体。
 */
export async function aggregateSearch(
  sources: VideoSource[],
  params: { keyword: string; page?: number; pageSize?: number },
): Promise<AggregateSearchResult> {
  const enabled = sources.filter((s) => s.enabled)
  const settled = await Promise.allSettled(
    enabled.map(async (s) => {
      const res: ListPage<VodItem> = await adapterProxy.search(s, {
        keyword: params.keyword,
        page: params.page ?? 1,
        ...(params.pageSize !== undefined ? { pageSize: params.pageSize } : {}),
      })
      return { source: s, res }
    }),
  )

  const list: (VodItem & { sourceName: string })[] = []
  const errors: AggregateSearchResult['errors'] = []

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      const { source, res } = r.value
      res.list.forEach((it) => {
        list.push({ ...it, sourceName: source.name })
      })
    } else {
      const source = enabled[settled.indexOf(r)]!
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
    }
  }

  return { list, errors }
}
