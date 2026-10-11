import { statSync } from 'node:fs'
import { basename, parse, resolve } from 'node:path'
import type { AddFolderInput, FolderKind, TrackedFolder, UpdateFolderInput } from '@shared/types'
import type { Db } from '../db/database'
import { nowIso } from '../util/time'

interface FolderRow {
  id: number
  path: string
  name: string
  kind: string
  recursive: number
  enabled: number
  createdAt: string
  fileCount: number
}

export function normalizeDirectory(input: string): string {
  let out = resolve(input)
  const { root } = parse(out)
  while (out.length > root.length && (out.endsWith('/') || out.endsWith('\\'))) {
    out = out.slice(0, -1)
  }
  return out
}

function toKind(value: unknown): FolderKind {
  return value === 'output' ? 'output' : 'library'
}

function mapFolder(row: FolderRow): TrackedFolder {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    kind: toKind(row.kind),
    recursive: row.recursive === 1,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    fileCount: row.fileCount
  }
}

const SELECT_FOLDER = `
  SELECT fo.id,
         fo.path,
         fo.name,
         fo.kind,
         fo.recursive,
         fo.enabled,
         fo.created_at AS createdAt,
         (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = fo.id AND fi.present = 1) AS fileCount
  FROM folders fo
`

export class FolderService {
  constructor(private readonly db: Db) {}

  list(): TrackedFolder[] {
    return this.db
      .all<FolderRow>(`${SELECT_FOLDER} ORDER BY fo.name COLLATE NOCASE ASC, fo.id ASC`)
      .map(mapFolder)
  }

  get(id: number): TrackedFolder | undefined {
    const row = this.db.get<FolderRow>(`${SELECT_FOLDER} WHERE fo.id = ?`, [id])
    return row ? mapFolder(row) : undefined
  }

  getByPath(folderPath: string): TrackedFolder | undefined {
    const row = this.db.get<FolderRow>(`${SELECT_FOLDER} WHERE fo.path = ?`, [folderPath])
    return row ? mapFolder(row) : undefined
  }

  listEnabled(): TrackedFolder[] {
    return this.db
      .all<FolderRow>(`${SELECT_FOLDER} WHERE fo.enabled = 1 ORDER BY fo.id ASC`)
      .map(mapFolder)
  }

  count(): number {
    const row = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM folders')
    return Number(row?.c ?? 0)
  }

  /**
   * Registers a folder. Throws if the path is not an existing directory.
   * Re-adding a known folder updates its options and re-enables it.
   */
  add(input: AddFolderInput): TrackedFolder {
    if (!input.path || !input.path.trim()) {
      throw new Error('A folder path is required.')
    }

    const folderPath = normalizeDirectory(input.path)
    const stats = statSync(folderPath)
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${folderPath}`)
    }

    const kind = toKind(input.kind)
    const recursive = input.recursive === false ? 0 : 1
    const name = basename(folderPath) || folderPath

    this.db.run(
      `INSERT INTO folders (path, name, kind, recursive, enabled, created_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(path) DO UPDATE SET
         kind      = excluded.kind,
         recursive = excluded.recursive,
         enabled   = 1`,
      [folderPath, name, kind, recursive, nowIso()]
    )

    const folder = this.getByPath(folderPath)
    if (!folder) throw new Error(`Failed to register folder: ${folderPath}`)
    return folder
  }

  update(input: UpdateFolderInput): TrackedFolder {
    const folder = this.get(input.id)
    if (!folder) throw new Error(`Unknown folder id: ${input.id}`)

    const sets: string[] = []
    const params: (string | number)[] = []

    if (input.kind !== undefined) {
      sets.push('kind = ?')
      params.push(toKind(input.kind))
    }
    if (input.recursive !== undefined) {
      sets.push('recursive = ?')
      params.push(input.recursive ? 1 : 0)
    }
    if (input.enabled !== undefined) {
      sets.push('enabled = ?')
      params.push(input.enabled ? 1 : 0)
    }

    if (sets.length > 0) {
      params.push(input.id)
      this.db.run(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`, params)
    }

    const updated = this.get(input.id)
    if (!updated) throw new Error(`Folder disappeared during update: ${input.id}`)
    return updated
  }

  /** Removes a folder and, by cascade, its indexed files. Print history is kept. */
  remove(id: number): void {
    this.db.run('DELETE FROM folders WHERE id = ?', [id])
  }
}
