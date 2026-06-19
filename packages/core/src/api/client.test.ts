import { describe, expect, it, vi } from 'vitest'
import { http } from './client'

vi.mock('./ua-pool', () => ({
  nextUA: vi.fn(() => 'MockAgent/1.0'),
}))

// Axios 拦截器内部结构未公开类型，用 any 访问
// biome-ignore lint/suspicious/noExplicitAny: 测试访问内部 handler
// biome-ignore lint/style/noNonNullAssertion: 测试用例已知 handler 存在
function getFulfilledHandler() {
  return (http.interceptors.request as unknown as { handlers: { fulfilled: (config: { url?: string; headers: { set: () => void } }) => { url?: string; headers: { set: () => void } } }[] }).handlers[0]!.fulfilled
}

function getRejectedHandler() {
  return (http.interceptors.response as unknown as { handlers: { rejected: (err: unknown) => unknown }[] }).handlers[0]!.rejected
}

describe('http client interceptors', () => {
  it('开发环境下浏览器请求 XML 源时重写为相对路径', () => {
    vi.stubGlobal('window', {})
    const setSpy = vi.fn()
    const config = { url: 'http://caiji.dyttzyapi.com/api.php/provide/vod/?ac=list', headers: { set: setSpy } }
    const result = getFulfilledHandler()(config)
    expect(result.url).toBe('/api.php/provide/vod/?ac=list')
    vi.unstubAllGlobals()
  })

  it('Node 环境不重写 XML 源 URL', () => {
    vi.stubGlobal('window', undefined)
    const setSpy = vi.fn()
    const config = { url: 'http://caiji.dyttzyapi.com/api.php/provide/vod/?ac=list', headers: { set: setSpy } }
    const result = getFulfilledHandler()(config)
    expect(result.url).toBe('http://caiji.dyttzyapi.com/api.php/provide/vod/?ac=list')
    vi.unstubAllGlobals()
  })

  it('非 XML 源 URL 不重写', () => {
    vi.stubGlobal('window', {})
    const setSpy = vi.fn()
    const config = { url: 'http://other.com/api.php/provide/vod/', headers: { set: setSpy } }
    const result = getFulfilledHandler()(config)
    expect(result.url).toBe('http://other.com/api.php/provide/vod/')
    vi.unstubAllGlobals()
  })

  it('请求拦截器每次都更新 User-Agent', () => {
    const setSpy = vi.fn()
    const config = { url: 'https://x.com', headers: { set: setSpy } }
    getFulfilledHandler()(config)
    expect(setSpy).toHaveBeenCalledWith('User-Agent', 'MockAgent/1.0')
  })

  it('响应拦截器在 err.response 存在时输出警告', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = {
      response: { status: 500 },
      config: { url: 'https://x.com' },
    }
    await expect(getRejectedHandler()(err)).rejects.toEqual(err)
    expect(warnSpy).toHaveBeenCalledWith('[http] status', 500, 'https://x.com')
    warnSpy.mockRestore()
  })

  it('响应拦截器在超时时输出警告', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = {
      code: 'ECONNABORTED',
      config: { url: 'https://x.com' },
    }
    await expect(getRejectedHandler()(err)).rejects.toEqual(err)
    expect(warnSpy).toHaveBeenCalledWith('[http] timeout', 'https://x.com')
    warnSpy.mockRestore()
  })

  it('响应拦截器在其他错误时输出警告', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = {
      message: 'network error',
      config: { url: 'https://x.com' },
    }
    await expect(getRejectedHandler()(err)).rejects.toEqual(err)
    expect(warnSpy).toHaveBeenCalledWith('[http] error', 'network error', 'https://x.com')
    warnSpy.mockRestore()
  })
})
