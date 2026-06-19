import UserAgent from 'user-agents'

/**
 * 设备类型，决定生成的 UA 池偏向
 * - mobile：手机（默认，资源站兼容最佳）
 * - desktop：PC
 * - tablet：平板
 */
export type DeviceType = 'mobile' | 'desktop' | 'tablet'

const DEFAULT_POOL_SIZE = 5

/**
 * UA 池：预生成 N 个不同 UA，按轮询方式提供
 * 用于绕过 mac-cms 等资源站对单一 UA 的频率限制 / 反爬
 *
 * 数据来源：user-agents（intoli 维护，每日更新真实浏览器使用数据）
 */
export class UAPool {
  private list: UserAgent[]
  private idx = 0
  private size: number
  private readonly device: DeviceType

  constructor(size: number = DEFAULT_POOL_SIZE, device: DeviceType = 'mobile') {
    this.size = size
    this.device = device
    this.list = this.regenerate(size, device)
  }

  /**
   * 重新生成池（设备类型变更或重置时调用）
   */
  reset(size?: number, device?: DeviceType): void {
    if (size !== undefined) this.size = size
    this.list = this.regenerate(size ?? this.size, device ?? this.device)
    this.idx = 0
  }

  /**
   * 取下一个 UA（轮询）
   */
  next(): string {
    if (this.list.length === 0) {
      // 防御性：极端情况下（库生成失败）回退到默认 mobile UA
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    }
    const ua = this.list[this.idx % this.list.length] as UserAgent
    this.idx++
    return ua.toString()
  }

  /**
   * 当前池大小
   */
  get length(): number {
    return this.list.length
  }

  private regenerate(size: number, device: DeviceType): UserAgent[] {
    return Array.from({ length: size }, () => new UserAgent({ deviceCategory: device }))
  }
}

/**
 * 全局默认 UA 池
 * 可被 setDeviceType() 重建
 */
let globalPool: UAPool | null = null

export function getUAPool(): UAPool {
  if (!globalPool) globalPool = new UAPool()
  return globalPool
}

export function setDeviceType(device: DeviceType): void {
  getUAPool().reset(undefined, device)
}

export function nextUA(): string {
  return getUAPool().next()
}
