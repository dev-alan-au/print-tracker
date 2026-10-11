import type { QueryResult, SchemaTable } from '@shared/types'
import type { Db } from '../db/database'

/** Statement kinds accepted while read-only mode is on. */
const READ_ONLY_PATTERN = /^\s*(select|with|explain|pragma|values)\b/i

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * SQLite hands back numbers, strings, BigInt and Uint8Array. BigInt and blobs
 * do not survive being rendered, so every cell is normalised to a string or a
 * number before it crosses IPC.
 */
function toCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array) return `<binary, ${value.length} bytes>`
  return String(value)
}

/**
 * Lets the user run SQL against the live database.
 *
 * Read-only mode is enforced twice: statements that are not obviously reads are
 * rejected up front, and everything is executed inside a transaction that is
 * always rolled back, so a misclassification cannot change any data.
 */
export class QueryService {
  constructor(private readonly db: Db) {}

  /** Tables and their columns, for the schema browser. */
  schema(): SchemaTable[] {
    const tables = this.db.all<{ name: string }>(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name`
    )

    return tables.map((table) => ({
      name: table.name,
      columns: this.db
        .all<{ name: string; type: string; notnull: number; pk: number }>(
          `PRAGMA table_info(${quoteIdentifier(table.name)})`
        )
        .map((column) => ({
          name: column.name,
          type: column.type || 'ANY',
          notNull: column.notnull === 1,
          primaryKey: column.pk > 0
        }))
    }))
  }

  run(sql: string, readOnly: boolean): QueryResult {
    const statement = sql.trim()
    if (!statement) throw new Error('Enter a statement to run.')

    if (readOnly && !READ_ONLY_PATTERN.test(statement)) {
      throw new Error('Read-only mode only allows SELECT, WITH, EXPLAIN, PRAGMA and VALUES.')
    }

    if (!readOnly) {
      // A trailing semicolon is not a second statement, but real content after
      // one is; exec() copes with several statements where run() does not.
      if (/;\s*\S/.test(statement)) {
        this.db.exec(statement)
        return { columns: [], rows: [], changes: null, rolledBack: false }
      }
      const info = this.db.run(statement)
      return { columns: [], rows: [], changes: info.changes, rolledBack: false }
    }

    this.db.exec('BEGIN')
    try {
      const rows = this.db.all<Record<string, unknown>>(statement)
      this.db.exec('ROLLBACK')

      return {
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows: rows.map((row) => {
          const cells: Record<string, string | number | null> = {}
          for (const [key, value] of Object.entries(row)) cells[key] = toCell(value)
          return cells
        }),
        changes: null,
        rolledBack: true
      }
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* the failing statement may already have ended the transaction */
      }
      throw error
    }
  }
}
