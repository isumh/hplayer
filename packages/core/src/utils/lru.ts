/**
 * 简易 LRU 缓存（Map-based）；用于适配器层请求缓存。
 */
export class LruCache<K, V> {
  private map = new Map<K, V>()
  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be > 0')
  }
  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    // 命中：刷新顺序
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.capacity) {
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
  }
  has(key: K): boolean {
    return this.map.has(key)
  }
  clear(): void {
    this.map.clear()
  }
}
