import { XMLParser } from 'fast-xml-parser'
import { http } from '../api/client'
import type { VideoSource } from '../types/source'
import type { Category, Episode, ListPage, PlayLine, VodDetail, VodItem } from '../types/vod'
import { clampPageSize } from '../utils/page-size'
import type { CmsAdapter, GetListParams, SearchParams } from './types'

interface XmlVideo {
  id?: string | number
  name?: string
  pic?: string
  type?: string
  year?: string | number
  area?: string
  actor?: string
  director?: string
  des?: string
  note?: string
  dl?: { dd?: XmlDd | XmlDd[] }
}

interface XmlDd {
  '@_flag'?: string
  '#text'?: string
}

interface XmlClassTy {
  '@_id'?: string | number
  '#text'?: string
}

interface XmlList {
  '@_page'?: string | number
  '@_pagecount'?: string | number
  '@_recordcount'?: string | number
  video?: XmlVideo | XmlVideo[]
}

interface XmlRss {
  list?: XmlList
  class?: { ty?: XmlClassTy | XmlClassTy[] }
}

function xmlNumber(value: string | number | undefined, fallback = 0): number {
  if (value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(n) ? fallback : n
}

function xmlString(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  const s = typeof value === 'string' ? value : String(value)
  return s.trim() || undefined
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function parsePlayLists(dl: XmlVideo['dl']): {
  playFrom: PlayLine[]
  playList: Record<string, Episode[]>
} {
  const playFrom: PlayLine[] = []
  const playList: Record<string, Episode[]> = {}
  if (!dl) return { playFrom, playList }

  const ddList = normalizeArray(dl.dd)
  for (const dd of ddList) {
    const name = xmlString(dd['@_flag']) ?? '默认线路'
    playFrom.push({ name })
    const text = dd['#text'] ?? ''
    playList[name] = text
      .split('#')
      .map((seg) => {
        const [n, u] = seg.split('$')
        return { name: (n ?? '').trim(), url: (u ?? '').trim() }
      })
      .filter((e) => e.url)
  }

  return { playFrom, playList }
}

function mapItem(it: XmlVideo, sourceId: string): VodItem {
  const item: VodItem = {
    id: String(it.id ?? ''),
    sourceId,
    name: xmlString(it.name) ?? '',
    pic: xmlString(it.pic) ?? '',
  }
  const year = it.year !== undefined ? String(it.year) : undefined
  if (year) item.year = year
  const area = xmlString(it.area)
  if (area) item.area = area
  const type = xmlString(it.type)
  if (type) item.type = type
  const actor = xmlString(it.actor)
  if (actor) item.actor = actor
  const director = xmlString(it.director)
  if (director) item.director = director
  const desc = xmlString(it.des)
  if (desc) item.desc = desc
  const remarks = xmlString(it.note)
  if (remarks) item.remarks = remarks
  return item
}

export class T0XmlAdapter implements CmsAdapter {
  readonly type = 't0_xml' as const
  private baseUrl = ''
  private defaultPageSize = 20
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
  })

  init(config: VideoSource): void {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.defaultPageSize = clampPageSize(config.pageSize, 20)
  }

  private async request(params: Record<string, string | number>): Promise<XmlRss> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
    const url = `${this.baseUrl}?${qs.toString()}`
    const { data } = await http.get<string>(url, { responseType: 'text' })
    return this.parseXml(data)
  }

  private parseXml(xml: string): XmlRss {
    try {
      const parsed = this.parser.parse(xml) as { rss?: XmlRss } | XmlRss
      return 'rss' in parsed && parsed.rss ? parsed.rss : (parsed as XmlRss)
    } catch {
      return {}
    }
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.request({ ac: 'list' })
    const tyList = normalizeArray(data.class?.ty)
    return tyList
      .map((ty) => {
        const id = xmlString(ty['@_id'])
        const name = xmlString(ty['#text'])
        if (!id || !name) return null
        return { id, name, sourceId: '' }
      })
      .filter((c): c is Category => c !== null)
  }

  private async getVideoList(params: Record<string, string | number>): Promise<ListPage<VodItem>> {
    const data = await this.request(params)
    const list = data.list ?? {}
    const videos = normalizeArray(list.video)
    const currentPage = xmlNumber(list['@_page'], 1)
    const pageCount = xmlNumber(list['@_pagecount'], currentPage)
    const total = xmlNumber(list['@_recordcount'], videos.length)
    return {
      list: videos.map((v) => mapItem(v, '')),
      total,
      pageCount,
      currentPage,
    }
  }

  async getList(params: GetListParams): Promise<ListPage<VodItem>> {
    return this.getVideoList({
      ac: 'videolist',
      t: params.categoryId,
      pg: params.page,
      pagesize: params.pageSize ?? this.defaultPageSize,
    })
  }

  async getDetail(id: string | number): Promise<VodDetail> {
    const data = await this.request({ ac: 'videolist', ids: id })
    const videos = normalizeArray(data.list?.video)
    const first = videos[0]
    if (!first) {
      throw new Error('T0_XML 详情返回为空')
    }
    const base = mapItem(first, '')
    const { playFrom, playList } = parsePlayLists(first.dl)
    return { ...base, playFrom, playList }
  }

  async search(params: SearchParams): Promise<ListPage<VodItem>> {
    return this.getVideoList({
      ac: 'videolist',
      wd: params.keyword,
      pg: params.page,
      pagesize: params.pageSize ?? this.defaultPageSize,
    })
  }
}
