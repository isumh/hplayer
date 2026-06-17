/**
 * V1 → V2 迁移占位。
 * V1 数据存于 localStorage，V2 将迁移到 Capacitor SQLite。
 * 当前 noop；V2 在 apps/hplayer_android 启动时实现具体逻辑。
 */
export async function migrateV1ToV2(): Promise<void> {
  // noop in V1
  return Promise.resolve();
}
