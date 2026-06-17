/**
 * 5 天滑动窗口（用户决策 #2）：
 * 当 now - lastAccessTime > 5 * 24h 时认为已过期，应被清理。
 */
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export function isExpired(lastAccessTime: number, now: number = Date.now()): boolean {
  return now - lastAccessTime > FIVE_DAYS_MS;
}
