import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { nextUA } from './ua-pool'

/**
 * 全局 Axios 实例，用于 CMS 适配器。
 * 浏览器直连第三方源，无后端。
 * - User-Agent 通过 UAPool 每次请求轮询，避免单一 UA 触发反爬
 */
export const http: AxiosInstance = axios.create({
  timeout: 15_000,
  headers: {
    'User-Agent': nextUA(),
  },
})

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 每次请求都换 UA，提升视频源数据获取成功率
  config.headers.set('User-Agent', nextUA())
  return config
})

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response) {
      console.warn('[http] status', err.response.status, err.config?.url)
    } else if (err.code === 'ECONNABORTED') {
      console.warn('[http] timeout', err.config?.url)
    } else {
      console.warn('[http] error', err.message, err.config?.url)
    }
    return Promise.reject(err)
  },
)
