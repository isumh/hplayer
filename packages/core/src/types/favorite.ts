import type { VodItem } from './vod';

export interface FavoriteItem {
  id: string;
  vod: VodItem;
  sourceId: string;
  createdAt: number;
}
