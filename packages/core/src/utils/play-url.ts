export type VideoProtocol = 'hls' | 'mp4' | 'flv' | 'unknown'

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'ftp:']

/**
 * 校验视频 URL 的 scheme 是否在白名单内，防止 javascript:/data: 等危险协议进入播放器
 */
export function isValidVideoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return ALLOWED_PROTOCOLS.includes(u.protocol)
  } catch {
    return false
  }
}

export function detectProtocol(url: string): VideoProtocol {
  if (!isValidVideoUrl(url)) return 'unknown'
  const lower = url.toLowerCase()
  if (lower.includes('.m3u8')) return 'hls'
  if (lower.includes('.flv')) return 'flv'
  if (lower.includes('.mp4')) return 'mp4'
  return 'unknown'
}
