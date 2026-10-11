import { readdirSync, statSync } from 'node:fs'
import type { Stats } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { FileQuery, Page, TrackedFile } from '@shared/types'
import type { Db } from '../db/database'
import { nowIso } from '../util/time'
import type { TrackedFolder } from '@shared/types'

interface FileRow {
  id: number
  folderId: number
  folderName: string | null
  path: string
  name: string
  ext: string | null
  size: number
  mtime: string | null
  present: number
  firstSeenAt: string
  lastSeenAt: string
  printedCount: number
  lastPrintedAt: string | null
}

const SELECT_FILE = `
  SELECT fi.id,
         fi.folder_id       AS folderId,
         fo.name            AS folderName,
         fi.path,
         fi.name,
         fi.ext,
         fi.size,
         fi.mtime,
         fi.present,
         fi.first_seen_at   AS firstSeenAt,
         fi.last_seen_at    AS lastSeenAt,
         fi.printed_count   AS printedCount,
         fi.last_printed_at AS lastPrintedAt
  FROM files fi
  LEFT JOIN folders fo ON fo.id = fi.folder_id
`

function mapFile(row: FileRow): TrackedFile {
  return {
    id: row.id,
    folderId: row.folderId,
    folderName: row.folderName,
    path: row.path,
    name: row.name,
    ext: row.ext,
    size: Number(row.size ?? 0),
    mtime: row.mtime,
    present: row.present === 1,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    printedCount: Number(row.printedCount ?? 0),
    lastPrintedAt: row.lastPrintedAt
  }
}

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

/** `report-b.docx` -> `report-b`; leaves extension-less names untouched. */
function stemOf(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '')
  return stem.length > 0 ? stem : name
}

const IGNORED_NAMES = new Set(['Thumbs.db', 'desktop.ini', 'ehthumbs.db', '.DS_Store'])

function shouldIgnore(name: string): boolean {
  if (!name) return true
  if (name.startsWith('.')) return true
  // Office/PDF editor lock files, e.g. "~$report.docx"
  if (name.startsWith('~$')) return true
  if (name.endsWith('.tmp') || name.endsWith('.crdownload') || name.endsWith('.part')) return true
  return IGNORED_NAMES.has(name)
}

export interface UpsertResult {
  fileId: number
  isNew: boolean
  file: TrackedFile
}

export class FileService {
  constructor(private readonly db: Db) {}

  get(id: number): TrackedFile | undefined {
    const row = this.db.get<FileRow>(`${SELECT_FILE} WHERE fi.id = ?`, [id])
    return row ? mapFile(row) : undefined
  }

  /** Inserts or refreshes a row from the filesystem. */
  upsertFromDisk(folderId: number, filePath: string, stats: Stats): UpsertResult {
    const now = nowIso()
    const name = basename(filePath)
    const ext = extname(filePath).replace(/^\./, '').toLowerCase() || null
    const size = Number(stats.size)
    const mtime = stats.mtime.toISOString()

    const existing = this.db.get<{ id: number }>('SELECT id FROM files WHERE path = ?', [filePath])

    if (existing) {
      this.db.run(
        `UPDATE files
            SET folder_id = ?, name = ?, ext = ?, size = ?, mtime = ?,
                present = 1, last_seen_at = ?
          WHERE id = ?`,
        [folderId, name, ext, size, mtime, now, existing.id]
      )
      return { fileId: existing.id, isNew: false, file: this.get(existing.id)! }
    }

    let insertedId: number
    try {
      const info = this.db.run(
        `INSERT INTO files
           (folder_id, path, name, ext, size, mtime, present, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [folderId, filePath, name, ext, size, mtime, now, now]
      )
      insertedId = info.lastInsertRowid
    } catch {
      // Lost a race with another scan - fall back to the row that now exists.
      const raced = this.db.get<{ id: number }>('SELECT id FROM files WHERE path = ?', [filePath])
      if (!raced) throw new Error(`Unable to index file: ${filePath}`)
      insertedId = raced.id
      this.db.run(
        `UPDATE files
            SET folder_id = ?, name = ?, ext = ?, size = ?, mtime = ?,
                present = 1, last_seen_at = ?
          WHERE id = ?`,
        [folderId, name, ext, size, mtime, now, insertedId]
      )
    }

    return { fileId: insertedId, isNew: true, file: this.get(insertedId)! }
  }

  /** Convenience wrapper that stats the file first. Returns null if unreadable. */
  upsertPath(folderId: number, filePath: string): UpsertResult | null {
    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) return null
      return this.upsertFromDisk(folderId, filePath, stats)
    } catch {
      return null
    }
  }

  markMissingByPath(filePath: string): void {
    this.db.run('UPDATE files SET present = 0 WHERE path = ?', [filePath])
  }

  removeByPath(filePath: string): void {
    this.db.run('DELETE FROM files WHERE path = ?', [filePath])
  }

  remove(id: number): void {
    this.db.run('DELETE FROM files WHERE id = ?', [id])
  }

  /**
   * Walks a folder and refreshes the index. Files that vanished since the scan
   * started are flagged as no longer present rather than deleted, so that print
   * history stays attached to them.
   */
  scanFolder(folder: TrackedFolder): number {
    const startedAt = nowIso()
    let indexed = 0

    let entries
    try {
      entries = readdirSync(folder.path, { withFileTypes: true, recursive: folder.recursive })
    } catch {
      return 0
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (shouldIgnore(entry.name)) continue

      const parent = (entry as { parentPath?: string }).parentPath ?? folder.path
      const fullPath = join(parent, entry.name)

      try {
        const stats = statSync(fullPath)
        if (!stats.isFile()) continue
        this.upsertFromDisk(folder.id, fullPath, stats)
        indexed++
      } catch {
        /* file disappeared mid-scan */
      }
    }

    this.db.run('UPDATE files SET present = 0 WHERE folder_id = ? AND last_seen_at < ?', [
      folder.id,
      startedAt
    ])

    return indexed
  }

  list(query: FileQuery): Page<TrackedFile> {
    const where: string[] = []
    const params: (string | number)[] = []

    if (query.folderId !== undefined && query.folderId !== null) {
      where.push('fi.folder_id = ?')
      params.push(query.folderId)
    }
    if (query.search && query.search.trim()) {
      where.push(`(fi.name LIKE ? ESCAPE '\\' OR fi.path LIKE ? ESCAPE '\\')`)
      const pattern = likePattern(query.search.trim())
      params.push(pattern, pattern)
    }
    if (query.printed === 'printed') {
      where.push('fi.printed_count > 0')
    } else if (query.printed === 'unprinted') {
      where.push('fi.printed_count = 0')
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const sortColumns: Record<string, string> = {
      name: 'fi.name COLLATE NOCASE',
      recent: 'fi.last_seen_at',
      prints: 'fi.printed_count',
      size: 'fi.size',
      lastPrinted: 'fi.last_printed_at'
    }
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
    const orderBy = sortColumns[query.sort ?? 'name'] ?? sortColumns.name

    const limit = Math.min(Math.max(query.limit ?? 200, 1), 1000)
    const offset = Math.max(query.offset ?? 0, 0)

    const totalRow = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM files fi ${whereSql}`,
      params
    )

    const rows = this.db.all<FileRow>(
      `${SELECT_FILE} ${whereSql} ORDER BY ${orderBy} ${direction}, fi.id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { items: rows.map(mapFile), total: Number(totalRow?.c ?? 0) }
  }

  /**
   * Best-effort match of a print spooler document name to an indexed file.
   *
   * Windows usually reports the document *title*, which may or may not carry
   * the file extension ("report-b" vs "report-b.docx"), so the name is compared
   * both with and without its extension.
   */
  findByDocumentName(documentName: string): TrackedFile | undefined {
    const needle = basename(documentName.trim())
    if (!needle) return undefined

    const byExactName = (candidate: string): FileRow | undefined =>
      this.db.get<FileRow>(
        `${SELECT_FILE} WHERE fi.name = ? COLLATE NOCASE ORDER BY fi.present DESC, fi.id DESC LIMIT 1`,
        [candidate]
      )

    // 1. Exact file name.
    const exact = byExactName(needle)
    if (exact) return mapFile(exact)

    const stem = stemOf(needle)

    // 2. The document name carried an extension but the indexed file does not.
    if (stem && stem !== needle) {
      const byStem = byExactName(stem)
      if (byStem) return mapFile(byStem)
    }

    // 3. The document name has no extension: find "stem.<ext>" instead,
    //    preferring the shortest candidate.
    if (stem) {
      const escaped = stem.replace(/[\\%_]/g, (match) => `\\${match}`)
      const prefixed = this.db.get<FileRow>(
        `${SELECT_FILE}
          WHERE fi.name LIKE ? ESCAPE '\\'
          ORDER BY LENGTH(fi.name) ASC, fi.present DESC, fi.id DESC
          LIMIT 1`,
        [`${escaped}.%`]
      )
      if (prefixed) return mapFile(prefixed)
    }

    return undefined
  }

  count(): number {
    const row = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM files WHERE present = 1')
    return Number(row?.c ?? 0)
  }
}
