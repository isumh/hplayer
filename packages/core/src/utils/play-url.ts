export type VideoProtocol = 'hls' | 'mp4' | 'flv' | 'unknown';

export function detectProtocol(url: string): VideoProtocol {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  if (lower.includes('.flv')) return 'flv';
  if (lower.includes('.mp4')) return 'mp4';
  return 'unknown';
}
