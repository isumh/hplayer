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
  /**
   * 保留分类：仅在首页分类栏显示这些名称对应的分类（按名称不区分大小写精确匹配）。
   * 为空或未配置时显示源返回的所有分类。
   */
  reservedCategories?: string[]
}
