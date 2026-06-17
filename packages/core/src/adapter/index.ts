import type { VideoSource } from '../types/source';
import type { Category, ListPage, VodDetail, VodItem } from '../types/vod';
import { LruCache } from '../utils/lru';
import { T0XmlAdapter } from './t0-xml';
import { T1JsonAdapter } from './t1-json';
import type { CmsAdapter, GetListParams, SearchParams } from './types';

const factories: Record<VideoSource['type'], new () => CmsAdapter> = {
  t0_xml: T0XmlAdapter,
  t1_json: T1JsonAdapter,
};

const cache = new LruCache<string, CmsAdapter>(50);

export function getAdapter(source: VideoSource): CmsAdapter {
  const existing = cache.get(source.id);
  if (existing) {
    existing.init(source);
    return existing;
  }
  const Adapter = factories[source.type];
  const inst = new Adapter();
  inst.init(source);
  cache.set(source.id, inst);
  return inst;
}

export function clearAdapterCache(sourceId?: string): void {
  if (sourceId) cache.clear();
  else cache.clear();
}

/**
 * 修正 VodItem 的 sourceId（适配器内部用 baseUrl 占位，调用方需要替换为真实 id）
 */
function fixSourceId<T extends { sourceId: string }>(list: T[], sourceId: string): T[] {
  return list.map((it) => ({ ...it, sourceId }));
}

export interface AdapterProxy {
  getCategories(source: VideoSource): Promise<Category[]>;
  getList(source: VideoSource, params: GetListParams): Promise<ListPage<VodItem>>;
  getDetail(source: VideoSource, id: string | number): Promise<VodDetail>;
  search(source: VideoSource, params: SearchParams): Promise<ListPage<VodItem>>;
}

export const adapterProxy: AdapterProxy = {
  async getCategories(source) {
    const a = getAdapter(source);
    return a.getCategories();
  },
  async getList(source, params) {
    const a = getAdapter(source);
    const res = await a.getList(params);
    return { ...res, list: fixSourceId(res.list, source.id) };
  },
  async getDetail(source, id) {
    const a = getAdapter(source);
    const res = await a.getDetail(id);
    return { ...res, sourceId: source.id };
  },
  async search(source, params) {
    const a = getAdapter(source);
    const res = await a.search(params);
    return { ...res, list: fixSourceId(res.list, source.id) };
  },
};
