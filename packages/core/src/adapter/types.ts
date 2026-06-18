import type { VideoSource } from '../types/source'
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod'

export interface GetListParams {
  categoryId: string | number
  page: number
  pageSize?: number
}

export interface SearchParams {
  keyword: string
  page: number
  pageSize?: number
}

export interface CmsAdapter {
  readonly type: VideoSource['type']
  init(config: VideoSource): void
  getCategories(): Promise<Category[]>
  getList(params: GetListParams): Promise<ListPage<VodItem>>
  getDetail(id: string | number): Promise<VodDetail>
  search(params: SearchParams): Promise<ListPage<VodItem>>
}
