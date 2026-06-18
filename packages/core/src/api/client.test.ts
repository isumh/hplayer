import { describe, expect, it, vi } from 'vitest'
import { http } from './client'

vi.mock('./ua-pool', () => ({
  nextUA: vi.fn(() => 'MockAgent/1.0'),
}))

// Axios 拦截器内部结构未公开类型，用 any 访问
// biome-ignore lint/suspicious/noExplicitAny: 测试访问内部 handler
// biome-ignore lint/style/noNonNullAssertion: 测试用例已知 handler 存在
function getRejectedHandler() {
  return (http.interceptors.response as unknown as { handlers: { rejected: (err: unknown) => unknown }[] }).handlers[0]!.rejected
}

describe('http client interceptors', () => {
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
