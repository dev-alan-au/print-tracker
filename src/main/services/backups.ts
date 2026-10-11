import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { BackupEntry } from '@shared/types'
import type { Db } from '../db/database'

const FILE_PREFIX = 'print-tracker-'
const FILE_SUFFIX = '.db'
/** How many snapshots to keep before the oldest are pruned. */
const KEEP = 10

/**
 * Where the fingerprint of the newest snapshot is remembered.
 *
 * Stored in the settings table, which `SettingsService` filters against its own
 * defaults, so an internal key like this stays invisible to the app and to the
 * settings screen. This key is excluded from the fingerprint itself, or writing
 * it would make every database look changed.
 */
const FINGERPRINT_KEY = 'backup.fingerprint'

export type BackupReason = 'launch' | 'manual'

/**
 * Database snapshots.
 *
 * Snapshots come from SQLite's `VACUUM INTO`, not a file copy: with WAL
 * enabled the newest writes live in the -wal sidecar, so copying just the .db
 * would silently lose them. `VACUUM INTO` writes a consistent single file.
 */
export class BackupService {
  constructor(
    private readonly db: Db,
    public readonly directory: string
  ) {}

  /**
   * Snapshots on launch, but only when something has actually changed.
   *
   * A snapshot per launch sounds safer than it is: a machine that opens the app
   * daily would burn all ten slots on identical copies of an unchanged
   * database, and the ten-deep history would then only reach back ten days
   * regardless of how much real work happened. Never throws - a failed backup
   * must not stop the app from starting.
   */
  createOnLaunch(): BackupEntry | null {
    try {
      if (!this.hasChangedSinceLastSnapshot()) return null
      return this.create('launch')
    } catch (error) {
      console.error('[backup] could not create launch snapshot:', (error as Error).message)
      return null
    }
  }

  /**
   * True when the database differs from the one the newest snapshot was taken
   * from. With no snapshot on record, the answer is yes: the first launch of a
   * fresh install is exactly when a backup is most worth having.
   */
  hasChangedSinceLastSnapshot(): boolean {
    const recorded = this.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      FINGERPRINT_KEY
    ])
    if (!recorded) return true
    return recorded.value !== this.fingerprint()
  }

  /**
   * A cheap stand-in for "has anything happened". Counts and the newest event
   * id catch folders and files coming and going, prints being recorded or
   * deleted, and settings being changed - without comparison against every row.
   *
   * Deliberately blind to `last_seen_at` churn: rescanning a folder touches
   * every row without changing anything a backup needs to preserve.
   */
  private fingerprint(): string {
    const row = this.db.get<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM folders)                                   AS folders,
         (SELECT COUNT(*) FROM files)                                     AS files,
         (SELECT COUNT(*) FROM print_events)                              AS prints,
         (SELECT COALESCE(MAX(id), 0) FROM print_events)                  AS newestEvent,
         (SELECT COALESCE(SUM(printed_count), 0) FROM files)              AS printTotal,
         (SELECT COALESCE(MAX(last_printed_at), '') FROM files)           AS lastPrinted,
         (SELECT COALESCE(GROUP_CONCAT(entry, '|'), '') FROM (
            SELECT key || '=' || value AS entry FROM settings
             WHERE key <> ? ORDER BY key
         )) AS settings`,
      [FINGERPRINT_KEY]
    )
    return JSON.stringify(row ?? {})
  }

  private rememberFingerprint(): void {
    this.db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [FINGERPRINT_KEY, this.fingerprint()]
    )
  }

  create(reason: BackupReason): BackupEntry {
    mkdirSync(this.directory, { recursive: true })

    // Colons and dots are not valid in Windows filenames.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')

    // The sequence is always present and zero padded, so sorting the filenames
    // as text matches the order they were created in. Without it, two backups
    // in the same millisecond would either collide (VACUUM INTO refuses to
    // overwrite) or sort the wrong way round.
    let sequence = 1
    let name = ''
    let path = ''
    do {
      name = `${FILE_PREFIX}${stamp}-${reason}-${String(sequence).padStart(2, '0')}${FILE_SUFFIX}`
      path = join(this.directory, name)
      sequence += 1
    } while (existsSync(path))

    this.db.backupTo(path)

    // Pruned here rather than at the call sites, so no route to a snapshot can
    // leave the directory over the limit. The fingerprint is recorded after the
    // snapshot exists, so a failure above leaves it stale and the next launch
    // tries again rather than assuming it is covered.
    this.prune()
    this.rememberFingerprint()

    const stats = statSync(path)
    return { name, path, size: stats.size, createdAt: stats.mtime.toISOString() }
  }

  /** Newest first. */
  list(): BackupEntry[] {
    try {
      return readdirSync(this.directory)
        .filter((name) => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX))
        .map((name) => {
          const path = join(this.directory, name)
          const stats = statSync(path)
          return { name, path, size: stats.size, createdAt: stats.mtime.toISOString() }
        })
        // Name breaks ties, and ascending names are chronological.
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name))
    } catch {
      // Directory not created yet.
      return []
    }
  }

  remove(path: string): void {
    // Guard against a path that escaped the backup directory.
    if (path !== this.directory && !path.startsWith(this.directory + sep)) {
      throw new Error('Refusing to delete a file outside the backup directory.')
    }
    unlinkSync(path)
  }

  private prune(): void {
    for (const entry of this.list().slice(KEEP)) {
      try {
        this.remove(entry.path)
      } catch {
        /* another snapshot may already be gone */
      }
    }
  }
}
