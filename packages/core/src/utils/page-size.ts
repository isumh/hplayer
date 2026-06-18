/**
 * 限制 pageSize 范围到 [1, 100]，并取整。
 * 用户决策 #3
 */
export function clampPageSize(n: number | undefined | null, fallback = 20): number {
  if (n === undefined || n === null || !Number.isFinite(n)) return fallback
  const v = Math.floor(n)
  if (v < 1) return 1
  if (v > 100) return 100
  return v
}
