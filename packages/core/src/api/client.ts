import axios, { type AxiosInstance } from 'axios';

/**
 * 全局 Axios 实例，用于 CMS 适配器。
 * 浏览器直连第三方源，无后端。
 */
export const http: AxiosInstance = axios.create({
  timeout: 15_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
});

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response) {
      console.warn('[http] status', err.response.status, err.config?.url);
    } else if (err.code === 'ECONNABORTED') {
      console.warn('[http] timeout', err.config?.url);
    } else {
      console.warn('[http] error', err.message, err.config?.url);
    }
    return Promise.reject(err);
  },
);
