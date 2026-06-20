/**
 * 规范化图片 URL。
 * 当 forceHttps 为 true 时，将 http:// 替换为 https://，用于修复 Android WebView
 * 混合内容（mixed content）导致部分源海报无法显示的问题。
 */
export function normalizeImageUrl(url: string, forceHttps = false): string {
  if (!url) return url
  if (forceHttps && url.startsWith('http://')) {
    return url.replace(/^http:\/\//, 'https://')
  }
  return url
}
