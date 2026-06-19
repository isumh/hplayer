import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import type { StorageAdapter } from './storage'

const DB_NAME = 'hplayer_db'
const TABLE_NAME = 'hplayer_kv'

let memoryCache: Record<string, unknown> = {}
let sqlite: SQLiteConnection | null = null
let db: SQLiteDBConnection | null = null

async function getDb(): Promise<SQLiteDBConnection> {
  if (db) return db
  sqlite = new SQLiteConnection(CapacitorSQLite)
  const consistency = await sqlite.checkConnectionsConsistency()
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result ?? false
  if (consistency.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  }
  await db.open()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)
  return db
}

export async function initCapacitorStorage(): Promise<void> {
  const connection = await getDb()
  const result = await connection.query(`SELECT key, value FROM ${TABLE_NAME};`)
  const values = result.values ?? []
  memoryCache = {}
  for (const row of values) {
    try {
      memoryCache[row.key as string] = JSON.parse(row.value as string)
    } catch {
      memoryCache[row.key as string] = row.value
    }
  }
}

async function persist(key: string): Promise<void> {
  const value = memoryCache[key]
  const connection = await getDb()
  if (value === undefined) {
    await connection.run(`DELETE FROM ${TABLE_NAME} WHERE key = ?;`, [key])
    return
  }
  await connection.run(`INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?, ?);`, [
    key,
    JSON.stringify(value),
  ])
}

export const capacitorStorageAdapter: StorageAdapter = {
  get<T>(key: string, fallback: T): T {
    if (key in memoryCache) return memoryCache[key] as T
    return fallback
  },
  set<T>(key: string, value: T): void {
    memoryCache[key] = value
    void persist(key)
  },
  remove(key: string): void {
    delete memoryCache[key]
    void persist(key)
  },
  clearAll(): void {
    memoryCache = {}
    void (async () => {
      const connection = await getDb()
      await connection.execute(`DELETE FROM ${TABLE_NAME};`)
    })()
  },
}

export async function closeCapacitorStorage(): Promise<void> {
  if (!db) return
  await db.close()
  db = null
}
