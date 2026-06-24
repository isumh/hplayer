import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'

// 模拟 SQLite 运行时
const mockDb: SQLiteDBConnection = {
  open: vi.fn(),
  close: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
  run: vi.fn(),
} as unknown as SQLiteDBConnection

const mockSqlite = {
  checkConnectionsConsistency: vi.fn(),
  isConnection: vi.fn(),
  retrieveConnection: vi.fn(),
  createConnection: vi.fn(),
} as unknown as SQLiteConnection

vi.doMock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: vi.fn(() => mockSqlite),
}))

async function loadModule() {
  const mod = await import('./storage-capacitor')
  return mod
}

describe('storage-capacitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSqlite.checkConnectionsConsistency = vi.fn().mockResolvedValue({ result: false })
    mockSqlite.isConnection = vi.fn().mockResolvedValue({ result: false })
    mockSqlite.createConnection = vi.fn().mockResolvedValue(mockDb)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('initCapacitorStorage 从数据库加载数据到内存', async () => {
    const { initCapacitorStorage, capacitorStorageAdapter } = await loadModule()
    ;(mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      values: [
        { key: 'hplayer:settings', value: '{"theme":"dark"}' },
        { key: 'hplayer:sources', value: '[{"id":"s1"}]' },
      ],
    })

    await initCapacitorStorage()

    expect(capacitorStorageAdapter.get('hplayer:settings', { theme: 'light' })).toEqual({ theme: 'dark' })
    expect(capacitorStorageAdapter.get('hplayer:sources', [])).toEqual([{ id: 's1' }])
  })

  it('set 更新内存并异步写入数据库', async () => {
    const { initCapacitorStorage, capacitorStorageAdapter } = await loadModule()
    ;(mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ values: [] })

    await initCapacitorStorage()
    capacitorStorageAdapter.set('hplayer:favorites', [{ id: 'f1' }])

    expect(capacitorStorageAdapter.get('hplayer:favorites', [])).toEqual([{ id: 'f1' }])
    await new Promise((r) => setTimeout(r, 10))
    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO hplayer_kv (key, value) VALUES (?, ?);',
      ['hplayer:favorites', '[{"id":"f1"}]'],
    )
  })

  it('remove 删除内存键并异步删除数据库记录', async () => {
    const { initCapacitorStorage, capacitorStorageAdapter } = await loadModule()
    ;(mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      values: [{ key: 'hplayer:history', value: '[{"id":"h1"}]' }],
    })

    await initCapacitorStorage()
    capacitorStorageAdapter.remove('hplayer:history')

    expect(capacitorStorageAdapter.get('hplayer:history', [])).toEqual([])
    await new Promise((r) => setTimeout(r, 10))
    expect(mockDb.run).toHaveBeenCalledWith(
      'DELETE FROM hplayer_kv WHERE key = ?;',
      ['hplayer:history'],
    )
  })
})
