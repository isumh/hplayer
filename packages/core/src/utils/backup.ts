import type { FavoriteItem } from '../types/favorite';
import type { HistoryItem } from '../types/history';
import type { VideoSource } from '../types/source';
import { STORAGE_KEYS, storage } from './storage';

/**
 * 用户数据备份文件结构
 * 包含视频源、收藏、观看历史三类核心数据
 */
export interface BackupFile {
  version: string;
  exportedAt: number;
  sources: VideoSource[];
  favorites: FavoriteItem[];
  history: HistoryItem[];
}

/**
 * 当前备份格式版本
 * 后续 schema 变更时同步递增
 */
export const BACKUP_VERSION = 'v0.1.0';

/**
 * 从 localStorage 读取所有用户数据并序列化为 JSON 字符串
 */
export function exportBackup(): string {
  const data: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    sources: storage.get<VideoSource[]>(STORAGE_KEYS.sources, []),
    favorites: storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, []),
    history: storage.get<HistoryItem[]>(STORAGE_KEYS.history, []),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 解析 JSON 字符串并写回 localStorage
 * @returns 解析并写入是否成功（sources 字段必须为数组才视为有效）
 */
export function importBackup(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Partial<BackupFile>;
    if (!data.sources || !Array.isArray(data.sources)) return false;
    storage.set(STORAGE_KEYS.sources, data.sources);
    if (Array.isArray(data.favorites)) storage.set(STORAGE_KEYS.favorites, data.favorites);
    if (Array.isArray(data.history)) storage.set(STORAGE_KEYS.history, data.history);
    return true;
  } catch {
    return false;
  }
}
