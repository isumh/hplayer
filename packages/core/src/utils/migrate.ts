import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './storage'
import type { StorageAdapter } from './storage-local'

const MIGRATION_KEY = 'hplayer:migrationVersion'

/**
 * V1 → V2 迁移：将 localStorage 中的数据迁移到新的 StorageAdapter（Android SQLite）。
 * 仅在 Android 原生平台调用，Web 端保持 localStorage 不变。
 */
export async function migrateV1ToV2(adapter: StorageAdapter): Promise<void> {
  const { value } = await Preferences.get({ key: MIGRATION_KEY })
  if (value === '2') return

  const migrateKey = (key: string): void => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        adapter.set(key, JSON.parse(raw))
      }
    } catch {
      // 忽略无法解析的旧数据
    }
  }

  for (const key of Object.values(STORAGE_KEYS)) {
    migrateKey(key)
  }

  await Preferences.set({ key: MIGRATION_KEY, value: '2' })
}
