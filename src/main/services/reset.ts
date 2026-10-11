import type { ResetCounts, ResetOptions, ResetPreview, ResetReport } from '@shared/types'
import type { Db } from '../db/database'
import type { BackupService } from './backups'

/**
 * Tables cleared by a reset.
 *
 * Order matters: print_events references files, and files references folders.
 * Not every table is declared `ON DELETE CASCADE` in a way that helps a bare
 * `DELETE FROM`, so the children go first.
 */
const TABLES = ['print_events', 'files', 'folders', 'students', 'settings'] as const

/**
 * Returns the application to the state it had on first run.
 *
 * The rows are deleted rather than the database file: the schema, indexes and
 * `user_version` all stay exactly as they are, so there is no migration to
 * replay and no closed-handle window where a stray query would throw. The
 * side effect is that this works identically on Windows, where a deleted file
 * stays locked until every handle is released.
 */
export class ResetService {
  constructor(
    private readonly db: Db,
    private readonly backups: BackupService
  ) {}

  private count(table: string): number {
    const row = this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)
    return Number(row?.c ?? 0)
  }

  /** What a reset would destroy, so the UI can be specific about it. */
  preview(): ResetPreview {
    return {
      counts: {
        folders: this.count('folders'),
        files: this.count('files'),
        prints: this.count('print_events')
      },
      backups: this.backups.list().length,
      databasePath: this.db.file,
      backupsDir: this.backups.directory
    }
  }

  reset(options: ResetOptions): ResetReport {
    const before = this.preview().counts

    // Deleting the old snapshots first means a snapshot taken below - the
    // safety net, which holds the data the user is about to lose - cannot be
    // swept up by `removeBackups`.
    let backupsRemoved = 0
    if (options.removeBackups) {
      for (const entry of this.backups.list()) {
        try {
          this.backups.remove(entry.path)
          backupsRemoved += 1
        } catch {
          /* a snapshot another process already removed */
        }
      }
    }

    const backup = options.backupFirst ? this.backups.create('manual') : null

    this.db.transaction(() => {
      for (const table of TABLES) {
        this.db.run(`DELETE FROM ${table}`)
      }
      // Every table uses AUTOINCREMENT, whose counters live in sqlite_sequence
      // and survive a DELETE. Without this the next folder would start at the
      // id the last one had, which does not look like a fresh install.
      try {
        this.db.run('DELETE FROM sqlite_sequence')
      } catch {
        /* no AUTOINCREMENT tables, nothing to reset */
      }
    })

    // Hand the freed pages back to the filesystem. Must run outside the
    // transaction above - SQLite refuses VACUUM inside one.
    try {
      this.db.exec('VACUUM')
    } catch {
      /* reclaiming space is best effort */
    }

    return { removed: before, backup, backupsRemoved }
  }

  /** Counts after a reset, used by the tests to assert the wipe was total. */
  isEmpty(): boolean {
    const counts: ResetCounts = this.preview().counts
    return counts.folders === 0 && counts.files === 0 && counts.prints === 0
  }
}
