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
  /** 是否将图片 URL 中的 http:// 强制替换为 https://，用于修复 Android WebView 混合内容问题 */
  forceHttpsImage?: boolean
}
