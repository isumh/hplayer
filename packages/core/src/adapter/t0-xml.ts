import type { VideoSource } from '../types/source';
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import { clampPageSize } from '../utils/page-size';
import type { CmsAdapter, GetListParams, SearchParams } from './types';

/**
 * T0_XML 适配器（V1 占位实现）。
 * V1 重点是 T1_JSON；T0_XML 接口在 V1.1 完整实现。
 */
export class T0XmlAdapter implements CmsAdapter {
  readonly type = 't0_xml' as const;
  private baseUrl = '';
  private defaultPageSize = 20;

  init(config: VideoSource): void {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultPageSize = clampPageSize(config.pageSize, 20);
    // V1 占位：baseUrl/defaultPageSize 将在 V1.1 用于实际 XML 请求
    void this.baseUrl;
    void this.defaultPageSize;
  }

  async getCategories(): Promise<Category[]> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async getList(_params: GetListParams): Promise<ListPage<VodItem>> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async getDetail(_id: string | number): Promise<VodDetail> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
  async search(_params: SearchParams): Promise<ListPage<VodItem>> {
    throw new Error('T0_XML 适配器将在 V1.1 实现');
  }
}
