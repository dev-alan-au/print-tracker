import { Database } from 'node-sqlite3-wasm'
import { MIGRATIONS, SCHEMA_VERSION } from './schema'

export type Row = Record<string, unknown>
export type BindValue = string | number | bigint | null | Uint8Array
export type BindParams = BindValue[] | BindValue

export interface RunInfo {
  changes: number
  lastInsertRowid: number
}

/**
 * Thin synchronous wrapper around `node-sqlite3-wasm`.
 *
 * The driver is a WebAssembly build of SQLite with a VFS that talks straight to
 * Node's `fs`, which means no native compilation - the same artifact works on
 * Linux during development and inside a Windows build.
 */
export class Db {
  private readonly db: Database

  constructor(public readonly file: string) {
    this.db = new Database(file)

    // Foreign keys are already on by default in this driver, but be explicit.
    this.safeExec('PRAGMA foreign_keys = ON;')
    this.safeExec('PRAGMA synchronous = NORMAL;')
    // WAL is a nice-to-have; not every VFS implementation supports it.
    this.safeExec('PRAGMA journal_mode = WAL;')

    this.migrate()
  }

  private safeExec(sql: string): void {
    try {
      this.db.exec(sql)
    } catch {
      /* non-fatal tuning pragma */
    }
  }

  private migrate(): void {
    const row = this.db.get('PRAGMA user_version') as { user_version?: number } | undefined
    const current = Number(row?.user_version ?? 0)
    if (current >= SCHEMA_VERSION) return

    for (let version = current; version < SCHEMA_VERSION; version++) {
      const script = MIGRATIONS[version]
      if (!script) continue
      this.db.exec('BEGIN')
      try {
        this.db.exec(script)
        this.db.exec(`PRAGMA user_version = ${version + 1}`)
        this.db.exec('COMMIT')
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw new Error(
          `Database migration ${version} -> ${version + 1} failed: ${(error as Error).message}`
        )
      }
    }
  }

  all<T = Row>(sql: string, params?: BindParams): T[] {
    return this.db.all(sql, params as never) as unknown as T[]
  }

  get<T = Row>(sql: string, params?: BindParams): T | undefined {
    const row = this.db.get(sql, params as never)
    return (row ?? undefined) as unknown as T | undefined
  }

  run(sql: string, params?: BindParams): RunInfo {
    const info = this.db.run(sql, params as never)
    return {
      changes: Number(info.changes),
      lastInsertRowid: Number(info.lastInsertRowid)
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  /** Runs `fn` inside a transaction, rolling back on any thrown error. */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* ignore rollback failures */
      }
      throw error
    }
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      /* already closed */
    }
  }
}
