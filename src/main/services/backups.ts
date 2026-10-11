import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { BackupEntry } from '@shared/types'
import type { Db } from '../db/database'

const FILE_PREFIX = 'print-tracker-'
const FILE_SUFFIX = '.db'
/** How many snapshots to keep before the oldest are pruned. */
const KEEP = 10

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

  /** Snapshots the database and prunes old ones. Never throws: a failed backup
   *  must not stop the app from starting. */
  createOnLaunch(): BackupEntry | null {
    try {
      const entry = this.create('launch')
      this.prune()
      return entry
    } catch (error) {
      console.error('[backup] could not create launch snapshot:', (error as Error).message)
      return null
    }
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
