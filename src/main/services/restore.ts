import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  BackupEntry,
  ResetCounts,
  RestoreInspection,
  RestoreProblem,
  RestoreReport
} from '@shared/types'
import { SCHEMA_VERSION } from '../db/schema'
import type { Db } from '../db/database'
import type { BackupService } from './backups'

/** Alias the candidate is attached under while it is being validated. */
const ALIAS = 'pt_restore_candidate'

/** Tables a usable snapshot must contain. */
const REQUIRED_TABLES = ['folders', 'files', 'print_events', 'settings'] as const

/**
 * Columns the copy depends on. A snapshot missing these cannot be restored,
 * and saying so up front beats failing halfway through with a SQLite message.
 */
const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  folders: ['id', 'path', 'name'],
  files: ['id', 'folder_id', 'path', 'name'],
  print_events: ['id', 'source', 'printed_at'],
  settings: ['key', 'value']
}

/** Parents before children, so foreign keys hold throughout the copy. */
const COPY_ORDER = ['folders', 'files', 'print_events', 'settings'] as const

function quoted(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Restores a snapshot over the live database.
 *
 * The rows are copied into the existing schema rather than the file being
 * swapped, which means a snapshot taken by an older build restores fine: the
 * columns it lacks are simply left at their defaults and migrations never have
 * to be replayed. Anything the candidate cannot supply is reported by
 * `inspect()` before a single row is touched.
 */
export class RestoreService {
  constructor(
    private readonly db: Db,
    private readonly backups: BackupService
  ) {}

  /** Validates a candidate file without modifying anything. */
  inspect(path: string): RestoreInspection {
    const target = resolve(path)
    const blank: RestoreInspection = {
      path: target,
      ok: false,
      problems: [],
      missingTables: [],
      missingColumns: [],
      counts: { folders: 0, files: 0, prints: 0 },
      schemaVersion: 0,
      supportedVersion: SCHEMA_VERSION,
      sizeBytes: 0,
      modifiedAt: null
    }

    // Attaching the live database to itself and then clearing it would delete
    // the very rows the copy was meant to read.
    if (target === resolve(this.db.file)) {
      return { ...blank, problems: ['sameFile'] }
    }

    let stats
    try {
      stats = statSync(target)
    } catch {
      return { ...blank, problems: ['missing'] }
    }
    if (!stats.isFile()) return { ...blank, problems: ['notAFile'] }

    const withSize = { ...blank, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() }
    if (stats.size === 0) return { ...withSize, problems: ['empty'] }

    try {
      this.db.run(`ATTACH DATABASE ? AS ${ALIAS}`, [target])
    } catch {
      return { ...withSize, problems: ['notADatabase'] }
    }

    try {
      // Reading a file that is not a SQLite database fails here rather than at
      // ATTACH, because the header is not examined until the first query.
      let integrity: { integrity_check?: string }[]
      try {
        integrity = this.db.all<{ integrity_check: string }>(`PRAGMA ${ALIAS}.integrity_check`)
      } catch {
        return { ...withSize, problems: ['notADatabase'] }
      }

      const problems: RestoreProblem[] = []
      if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
        problems.push('corrupt')
      }

      const present = new Set(
        this.db
          .all<{ name: string }>(`SELECT name FROM ${ALIAS}.sqlite_master WHERE type = 'table'`)
          .map((row) => row.name)
      )
      const missingTables = REQUIRED_TABLES.filter((table) => !present.has(table))
      if (missingTables.length > 0) problems.push('missingTables')

      const missingColumns: string[] = []
      for (const table of REQUIRED_TABLES) {
        if (!present.has(table)) continue
        const columns = new Set(this.columnsOf(ALIAS, table))
        for (const column of REQUIRED_COLUMNS[table]) {
          if (!columns.has(column)) missingColumns.push(`${table}.${column}`)
        }
      }
      if (missingColumns.length > 0) problems.push('missingColumns')

      const schemaVersion = Number(this.pragma(ALIAS, 'user_version') ?? 0)
      if (schemaVersion > SCHEMA_VERSION) problems.push('newerSchema')

      // Only meaningful once the tables it walks actually exist.
      if (missingTables.length === 0) {
        const violations = this.db.all(`PRAGMA ${ALIAS}.foreign_key_check`)
        if (violations.length > 0) problems.push('foreignKeyViolations')
      }

      // Each count is guarded by the table actually being there. Counting a
      // missing table throws, which would turn "this file is not a snapshot"
      // into an unexplained SQL error instead of a reported problem.
      const counts: ResetCounts = {
        folders: present.has('folders') ? this.count(ALIAS, 'folders') : 0,
        files: present.has('files') ? this.count(ALIAS, 'files') : 0,
        prints: present.has('print_events') ? this.count(ALIAS, 'print_events') : 0
      }

      return {
        ...withSize,
        ok: problems.length === 0,
        problems,
        missingTables,
        missingColumns,
        counts,
        schemaVersion
      }
    } finally {
      // Leaving a candidate attached would keep a lock on it - which on Windows
      // means the user cannot delete or overwrite their own file afterwards.
      this.detach()
    }
  }

  /** Replaces the live data with the contents of `path`. */
  restore(path: string): RestoreReport {
    const inspection = this.inspect(path)
    if (!inspection.ok) {
      throw new Error(`This file cannot be restored (${inspection.problems.join(', ')}).`)
    }

    // A restore destroys data that cannot otherwise be recovered, so the
    // replacement is always reversible. `backups.create` fails loudly rather
    // than silently proceeding without one.
    const backup: BackupEntry = this.backups.create('manual')

    let restored: ResetCounts = { folders: 0, files: 0, prints: 0 }
    this.db.run(`ATTACH DATABASE ? AS ${ALIAS}`, [inspection.path])
    try {
      this.db.transaction(() => {
        for (const table of [...COPY_ORDER].reverse()) {
          this.db.run(`DELETE FROM ${quoted(table)}`)
        }
        // The snapshot carries explicit ids, and AUTOINCREMENT lifts the
        // counter to the highest one as it inserts, so clearing first keeps
        // the restored ids exactly as they were.
        try {
          this.db.run('DELETE FROM sqlite_sequence')
        } catch {
          /* no AUTOINCREMENT tables */
        }

        for (const table of COPY_ORDER) this.copyTable(table)

        restored = {
          folders: this.count('main', 'folders'),
          files: this.count('main', 'files'),
          prints: this.count('main', 'print_events')
        }
      })
    } finally {
      this.detach()
    }

    try {
      this.db.exec('VACUUM')
    } catch {
      /* reclaiming space is best effort */
    }

    return { restored, backup, schemaVersion: inspection.schemaVersion }
  }

  /**
   * Copies the columns the two schemas have in common. A snapshot from an older
   * build is missing columns this build added; those keep their defaults
   * instead of the copy failing.
   */
  private copyTable(table: string): void {
    const local = new Set(this.columnsOf('main', table))
    const shared = this.columnsOf(ALIAS, table).filter((column) => local.has(column))
    if (shared.length === 0) return

    const list = shared.map(quoted).join(', ')
    this.db.run(
      `INSERT INTO ${quoted(table)} (${list}) SELECT ${list} FROM ${ALIAS}.${quoted(table)}`
    )
  }

  private columnsOf(schema: string, table: string): string[] {
    return this.db
      .all<{ name: string }>(`PRAGMA ${schema}.table_info(${quoted(table)})`)
      .map((column) => column.name)
  }

  private count(schema: string, table: string): number {
    const row = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${schema}.${quoted(table)}`)
    return Number(row?.c ?? 0)
  }

  private pragma(schema: string, name: string): unknown {
    const row = this.db.get<Record<string, unknown>>(`PRAGMA ${schema}.${name}`)
    return row?.[name]
  }

  private detach(): void {
    try {
      this.db.run(`DETACH DATABASE ${ALIAS}`)
    } catch {
      /* never attached, or already detached */
    }
  }
}
