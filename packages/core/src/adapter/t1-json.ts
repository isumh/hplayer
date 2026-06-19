import { http } from '../api/client'
import type { VideoSource } from '../types/source'
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod'
import { clampPageSize } from '../utils/page-size'
import { isValidVideoUrl } from '../utils/play-url'
import type { CmsAdapter, GetListParams, SearchParams } from './types'

interface MacCmsListItem {
  vod_id: number | string
  vod_name: string
  vod_pic: string
  vod_remarks?: string
  vod_year?: string
  vod_area?: string
  vod_class?: string
  vod_actor?: string
  vod_director?: string
  vod_content?: string
  type_id?: number | string
  type_name?: string
}

interface MacCmsListResp {
  code: number
  msg?: string
  page?: number
  pagecount?: number
  total?: number
  list?: MacCmsListItem[]
}

interface MacCmsDetailResp {
  code: number
  msg?: string
  list?: MacCmsListItem[]
}

function mapItem(it: MacCmsListItem, sourceId: string): VodItem {
  const item: VodItem = {
    id: String(it.vod_id),
    sourceId,
    name: it.vod_name,
    pic: it.vod_pic,
  }
  if (it.vod_year !== undefined) item.year = it.vod_year
  if (it.vod_area !== undefined) item.area = it.vod_area
  if (it.vod_class !== undefined) item.type = it.vod_class
  else if (it.type_name !== undefined) item.type = it.type_name
  if (it.vod_remarks !== undefined) item.remarks = it.vod_remarks
  if (it.vod_actor !== undefined) item.actor = it.vod_actor
  if (it.vod_director !== undefined) item.director = it.vod_director
  if (it.vod_content !== undefined) item.desc = it.vod_content
  return item
}

function parsePlayLists(
  playFrom: string,
  playUrl: string,
): {
  playFromArr: { name: string }[]
  playList: Record<string, { name: string; url: string }[]>
} {
  const fromArr = playFrom
    .split('$$$')
    .map((s) => s.trim())
    .filter(Boolean)
  const urlArr = playUrl.split('$$$')
  const playList: Record<string, { name: string; url: string }[]> = {}
  fromArr.forEach((name, i) => {
    const lineRaw = urlArr[i] ?? ''
    playList[name] = lineRaw
      .split('#')
      .map((seg) => {
        const idx = seg.indexOf('$')
        const n = idx === -1 ? seg : seg.slice(0, idx)
        const u = idx === -1 ? '' : seg.slice(idx + 1)
        return { name: n.trim(), url: u.trim() }
      })
      .filter((e) => isValidVideoUrl(e.url))
  })
  return { playFromArr: fromArr.map((n) => ({ name: n })), playList }
}

export class T1JsonAdapter implements CmsAdapter {
  readonly type = 't1_json' as const
  private baseUrl = ''
  private defaultPageSize = 20

  init(config: VideoSource): void {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.defaultPageSize = clampPageSize(config.pageSize, 20)
  }

  private async get<T>(params: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
    const { data } = await http.get<T>(`${this.baseUrl}?${qs.toString()}`)
    return data
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.get<MacCmsListResp>({ ac: 2 })
    // ac=2 返回分类列表，字段为 list，每个含 type_id/type_name
    const list =
      (data as unknown as { class?: { type_id: number | string; type_name: string }[] }).class ?? []
    const sourceId = this.baseUrl // 用 baseUrl 作为 sourceId 占位，由调用方覆盖
    return list.map((c) => ({ id: String(c.type_id), name: c.type_name, sourceId }))
  }

  async getList({ categoryId, page, pageSize }: GetListParams): Promise<ListPage<VodItem>> {
    const ps = clampPageSize(pageSize, this.defaultPageSize)
    const data = await this.get<MacCmsListResp>({
      ac: 'videolist',
      t: categoryId,
      pg: page,
      pagesize: ps,
    })
    const list = data.list ?? []
    return {
      list: list.map((it) => mapItem(it, this.baseUrl)),
      total: data.total ?? 0,
      pageCount: data.pagecount ?? 1,
      currentPage: data.page ?? page,
    }
  }

  async getDetail(id: string | number): Promise<VodDetail> {
    const data = await this.get<MacCmsDetailResp>({ ac: 'detail', ids: id })
    const it = (data.list ?? [])[0]
    if (!it) throw new Error('detail not found')
    const base = mapItem(it, this.baseUrl)
    const playFrom = (it as unknown as { vod_play_from?: string }).vod_play_from ?? ''
    const playUrl = (it as unknown as { vod_play_url?: string }).vod_play_url ?? ''
    const { playFromArr, playList } = parsePlayLists(playFrom, playUrl)
    return { ...base, playFrom: playFromArr, playList }
  }

  async search({ keyword, page, pageSize }: SearchParams): Promise<ListPage<VodItem>> {
    const ps = clampPageSize(pageSize, this.defaultPageSize)
    const data = await this.get<MacCmsListResp>({
      ac: 'videolist',
      wd: keyword,
      pg: page,
      pagesize: ps,
    })
    const list = data.list ?? []
    return {
      list: list.map((it) => mapItem(it, this.baseUrl)),
      total: data.total ?? 0,
      pageCount: data.pagecount ?? 1,
      currentPage: data.page ?? page,
    }
  }
}
