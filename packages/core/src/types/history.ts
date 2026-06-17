import type { Episode, VodItem } from './vod';

export interface HistoryItem {
  id: string;
  vod: VodItem;
  sourceId: string;
  episode?: Episode;
  progress: number;
  duration?: number;
  lastWatchTime: number;
}
