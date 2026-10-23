import Database from '@tauri-apps/plugin-sql'

export const DB_URL = 'sqlite:deepseek-pet.db'

let database: Database | null = null
let loading: Promise<Database> | null = null

export async function getDb(): Promise<Database> {
  if (database) return database
  if (!loading) {
    loading = Database.load(DB_URL)
      .then(async (db) => {
        database = db
        // Foreign keys are per-connection; this is best-effort defense in depth.
        await db.execute('PRAGMA foreign_keys = ON').catch(() => undefined)
        return db
      })
      .catch((error) => {
        loading = null
        throw new Error(`无法打开本地数据库：${String(error)}`)
      })
  }
  return loading
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb()
  return db.select<T[]>(sql, params)
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb()
  await db.execute(sql, params)
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}
