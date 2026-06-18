export type SourceType = 't0_xml' | 't1_json'

export interface VideoSource {
  id: string
  name: string
  type: SourceType
  baseUrl: string
  pageSize?: number
  enabled: boolean
  createdAt: number
  order: number
  remark?: string
}
