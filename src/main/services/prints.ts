import type {
  DashboardStats,
  ManualPrintInput,
  MessageParams,
  Page,
  PrintEvent,
  PrintQuery,
  PrintSource,
  RecordPrintInput
} from '@shared/types'
import type { Db } from '../db/database'
import { addDays, dayKey, isValidIso, nowIso, startOfLocalDay, startOfLocalWeek } from '../util/time'

interface EventRow {
  id: number
  fileId: number | null
  fileName: string | null
  filePath: string | null
  source: string
  printer: string | null
  documentName: string | null
  copies: number
  pages: number | null
  userName: string | null
  status: string | null
  note: string | null
  noteKey: string | null
  noteParams: string | null
  studentId: number | null
  studentName: string | null
  printedAt: string
  createdAt: string
}

/**
 * Shared row source. The search filter can reference `fo.*`, so the pagination
 * COUNT has to use exactly the same joins.
 */
const FROM_EVENT = `
  FROM print_events p
  LEFT JOIN files fi   ON fi.id = p.file_id
  LEFT JOIN folders fo ON fo.id = fi.folder_id
`

const SELECT_EVENT = `
  SELECT p.id,
         p.file_id       AS fileId,
         fi.name         AS fileName,
         fi.path         AS filePath,
         p.source,
         p.printer,
         p.document_name AS documentName,
         p.copies,
         p.pages,
         p.user_name     AS userName,
         p.status,
         p.note,
         p.note_key      AS noteKey,
         p.note_params   AS noteParams,
         p.student_id    AS studentId,
         p.student_name  AS studentName,
         p.printed_at    AS printedAt,
         p.created_at    AS createdAt
  ${FROM_EVENT}
`

const SOURCES: PrintSource[] = ['watcher', 'spooler', 'manual', 'app']

function toSource(value: unknown): PrintSource {
  return SOURCES.includes(value as PrintSource) ? (value as PrintSource) : 'manual'
}

function mapEvent(row: EventRow): PrintEvent {
  const fileName = row.fileName ?? row.documentName
  return {
    id: row.id,
    fileId: row.fileId === null ? null : Number(row.fileId),
    fileName,
    filePath: row.filePath,
    source: toSource(row.source),
    printer: row.printer,
    documentName: row.documentName,
    copies: Number(row.copies ?? 1),
    pages: row.pages === null ? null : Number(row.pages),
    userName: row.userName,
    status: row.status,
    note: row.note,
    noteKey: (row.noteKey as PrintEvent['noteKey']) ?? null,
    noteParams: parseParams(row.noteParams),
    studentId: row.studentId === null ? null : Number(row.studentId),
    studentName: row.studentName,
    printedAt: row.printedAt,
    createdAt: row.createdAt
  }
}

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

/** `note_params` is a JSON object; tolerate anything malformed or legacy. */
function parseParams(raw: string | null): MessageParams | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as MessageParams
    }
  } catch {
    /* fall through to null */
  }
  return null
}

const HISTORY_DAYS = 14

/**
 * How long a print started from inside the app suppresses an echo of itself.
 *
 * Printing from the app and monitoring the Windows spooler are not exclusive:
 * the spooler sees every job, including the ones this app queued, so without
 * this the history would show two entries and a doubled counter for a single
 * print. Generous, because the spooler polls on an interval rather than
 * instantly; the cost of the window being too long is that a genuine reprint of
 * the same file within it is missed.
 */
const ECHO_WINDOW_MS = 60_000

export class PrintService {
  constructor(
    private readonly db: Db,
    /**
     * Who is using the app right now, read at the moment a print is recorded.
     *
     * A provider rather than a plain value because the watcher and the spooler
     * record prints on their own schedule, long after whatever set the
     * selection, and because the person at the keyboard can change while the
     * app is running.
     */
    private readonly currentStudentId: () => number | null = () => null
  ) {}

  /**
   * The student a print belongs to, with the name captured alongside the id.
   * A selection that no longer exists is recorded as no student rather than
   * being allowed to fail the print.
   */
  private resolveStudent(explicit?: number | null): { id: number | null; name: string | null } {
    const id = explicit ?? this.currentStudentId()
    if (id === null || id === undefined) return { id: null, name: null }

    const row = this.db.get<{ name: string }>('SELECT name FROM students WHERE id = ?', [id])
    return row ? { id, name: row.name } : { id: null, name: null }
  }

  getById(id: number): PrintEvent | undefined {
    const row = this.db.get<EventRow>(`${SELECT_EVENT} WHERE p.id = ?`, [id])
    return row ? mapEvent(row) : undefined
  }

  /**
   * Stores a print event. Returns `null` when a deduplicated event (same
   * `externalId`) has already been seen.
   */
  record(input: RecordPrintInput): PrintEvent | null {
    if (this.isEchoOfAppPrint(input)) return null

    if (input.externalId) {
      const duplicate = this.db.get<{ id: number }>(
        'SELECT id FROM print_events WHERE external_id = ?',
        [input.externalId]
      )
      if (duplicate) return null
    }

    let fileId = input.fileId ?? null
    let documentName = input.documentName?.trim() || null

    if (fileId !== null) {
      const file = this.db.get<{ name: string }>('SELECT name FROM files WHERE id = ?', [fileId])
      if (file) {
        documentName = documentName ?? file.name
      } else {
        fileId = null
      }
    }

    const printedAt = isValidIso(input.printedAt) ? input.printedAt : nowIso()
    const copies = Math.max(1, Math.round(Number(input.copies ?? 1)) || 1)
    const student = this.resolveStudent(input.studentId)

    let insertedId: number
    try {
      const info = this.db.run(
        `INSERT INTO print_events
           (file_id, source, printer, document_name, copies, pages,
            user_name, status, note, note_key, note_params,
            external_id, student_id, student_name, printed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileId,
          toSource(input.source),
          input.printer?.trim() || null,
          documentName,
          copies,
          input.pages === undefined || input.pages === null ? null : Number(input.pages),
          input.userName?.trim() || null,
          input.status?.trim() || null,
          input.note?.trim() || null,
          input.noteKey ?? null,
          input.noteParams ? JSON.stringify(input.noteParams) : null,
          input.externalId ?? null,
          student.id,
          student.name,
          printedAt,
          nowIso()
        ]
      )
      insertedId = info.lastInsertRowid
    } catch {
      // Unique external_id collision (concurrent poll) - treat as duplicate.
      return null
    }

    if (fileId !== null) {
      this.db.run(
        `UPDATE files
            SET printed_count   = printed_count + 1,
                last_printed_at = CASE
                  WHEN last_printed_at IS NULL OR last_printed_at < ? THEN ?
                  ELSE last_printed_at
                END
          WHERE id = ?`,
        [printedAt, printedAt, fileId]
      )
    }

    return this.getById(insertedId) ?? null
  }

  /** Manual "Mark as printed" entry. */
  addManual(input: ManualPrintInput): PrintEvent {
    let fileId = input.fileId ?? null
    let documentName = input.documentName?.trim() || null

    if (fileId !== null) {
      const file = this.db.get<{ id: number; name: string }>('SELECT id, name FROM files WHERE id = ?', [
        fileId
      ])
      if (!file) {
        fileId = null
      } else {
        documentName = documentName ?? file.name
      }
    }

    if (fileId === null && documentName) {
      const match = this.db.get<{ id: number }>(
        'SELECT id FROM files WHERE name = ? COLLATE NOCASE ORDER BY present DESC, id DESC LIMIT 1',
        [documentName]
      )
      if (match) fileId = match.id
    }

    if (fileId === null && !documentName) {
      throw new Error('Provide a file or a document name for the print event.')
    }

    const event = this.record({
      fileId,
      documentName,
      source: 'manual',
      printer: input.printer ?? null,
      copies: input.copies ?? 1,
      pages: input.pages ?? null,
      note: input.note ?? null,
      printedAt: input.printedAt ?? nowIso()
    })

    if (!event) throw new Error('The print event could not be recorded.')
    return event
  }

  remove(id: number): void {
    const row = this.db.get<{ file_id: number | null }>(
      'SELECT file_id FROM print_events WHERE id = ?',
      [id]
    )
    if (!row) return

    this.db.transaction(() => {
      this.db.run('DELETE FROM print_events WHERE id = ?', [id])
      if (row.file_id !== null) {
        this.recalculateFileCounters(row.file_id)
      }
    })
  }

  private recalculateFileCounters(fileId: number): void {
    this.db.run(
      `UPDATE files
          SET printed_count   = (SELECT COUNT(*) FROM print_events WHERE file_id = ?),
              last_printed_at = (SELECT MAX(printed_at) FROM print_events WHERE file_id = ?)
        WHERE id = ?`,
      [fileId, fileId, fileId]
    )
  }

  /**
   * True when an automatically detected print is really the app reporting its
   * own print job back to itself. Manual entries are never suppressed - the
   * user saying "this was printed" outranks any inference.
   */
  private isEchoOfAppPrint(input: RecordPrintInput): boolean {
    if (input.source !== 'spooler' && input.source !== 'watcher') return false
    if (input.fileId === undefined || input.fileId === null) return false

    const since = new Date(Date.now() - ECHO_WINDOW_MS).toISOString()
    const row = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM print_events
        WHERE file_id = ? AND source = 'app' AND printed_at >= ?`,
      [input.fileId, since]
    )
    return Number(row?.c ?? 0) > 0
  }

  list(query: PrintQuery): Page<PrintEvent> {
    const where: string[] = []
    const params: (string | number)[] = []

    if (query.source) {
      where.push('p.source = ?')
      params.push(query.source)
    }
    if (query.fileId !== undefined && query.fileId !== null) {
      where.push('p.file_id = ?')
      params.push(query.fileId)
    }
    if (query.studentId !== undefined && query.studentId !== null) {
      where.push('p.student_id = ?')
      params.push(query.studentId)
    }
    if (query.from && isValidIso(query.from)) {
      where.push('p.printed_at >= ?')
      params.push(query.from)
    }
    if (query.to && isValidIso(query.to)) {
      where.push('p.printed_at <= ?')
      params.push(query.to)
    }
    if (query.search && query.search.trim()) {
      where.push(
        `(COALESCE(p.document_name, '') LIKE ? ESCAPE '\\'
          OR COALESCE(fi.name, '') LIKE ? ESCAPE '\\'
          OR COALESCE(p.printer, '') LIKE ? ESCAPE '\\'
          OR COALESCE(p.note, '') LIKE ? ESCAPE '\\'
          OR COALESCE(fo.name, '') LIKE ? ESCAPE '\\'
          OR COALESCE(fo.path, '') LIKE ? ESCAPE '\\')`
      )
      const pattern = likePattern(query.search.trim())
      params.push(pattern, pattern, pattern, pattern, pattern, pattern)
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const limit = Math.min(Math.max(query.limit ?? 200, 1), 2000)
    const offset = Math.max(query.offset ?? 0, 0)

    const totalRow = this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c ${FROM_EVENT} ${whereSql}`,
      params
    )

    const rows = this.db.all<EventRow>(
      `${SELECT_EVENT} ${whereSql} ORDER BY p.printed_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return { items: rows.map(mapEvent), total: Number(totalRow?.c ?? 0) }
  }

  count(): number {
    const row = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM print_events')
    return Number(row?.c ?? 0)
  }

  /**
   * The dashboard's figures.
   *
   * Everything about prints follows the student using the app, the same way the
   * history and the file counts do: a screen that says "as Lena" everywhere else
   * and then counts the whole class's printing here would be the odd one out.
   * Folder and file totals are about the library rather than about anybody's
   * printing, so they stay global.
   *
   * The student is an extra predicate on each print query. `and` and `where` are
   * two forms of the same thing because some of these queries already filter by
   * date; the parameter is also bound last every time, so the placeholders and
   * the values cannot drift apart.
   */
  stats(studentId: number | null = null): DashboardStats {
    const countOf = (sql: string, params?: (string | number)[]): number =>
      Number(this.db.get<{ c: number }>(sql, params)?.c ?? 0)

    const todayStart = startOfLocalDay().toISOString()
    const weekStart = startOfLocalWeek().toISOString()

    const scopedParams: (string | number)[] = studentId === null ? [] : [studentId]
    const and = studentId === null ? '' : ' AND p.student_id = ?'
    const where = studentId === null ? '' : ' WHERE p.student_id = ?'

    const printsToday = countOf(
      `SELECT COUNT(*) AS c FROM print_events p WHERE p.printed_at >= ?${and}`,
      [todayStart, ...scopedParams]
    )
    const printsThisWeek = countOf(
      `SELECT COUNT(*) AS c FROM print_events p WHERE p.printed_at >= ?${and}`,
      [weekStart, ...scopedParams]
    )

    const bySourceRows = this.db.all<{ source: string; c: number }>(
      `SELECT p.source AS source, COUNT(*) AS c FROM print_events p${where} GROUP BY p.source`,
      scopedParams
    )
    const printsBySource = bySourceRows.map((row) => ({
      source: toSource(row.source),
      count: Number(row.c)
    }))

    // Bucket the last 14 days by *local* calendar day.
    const windowStart = startOfLocalDay(addDays(new Date(), -(HISTORY_DAYS - 1))).toISOString()
    const recentTimestamps = this.db.all<{ printedAt: string }>(
      `SELECT p.printed_at AS printedAt FROM print_events p WHERE p.printed_at >= ?${and}`,
      [windowStart, ...scopedParams]
    )
    const buckets = new Map<string, number>()
    for (let offset = 0; offset < HISTORY_DAYS; offset++) {
      buckets.set(dayKey(addDays(startOfLocalDay(), -(HISTORY_DAYS - 1 - offset))), 0)
    }
    for (const row of recentTimestamps) {
      const key = dayKey(row.printedAt)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const printsByDay = [...buckets.entries()].map(([day, count]) => ({ day, count }))

    const topFiles = this.db
      .all<{ fileId: number | null; name: string | null; c: number }>(
        `SELECT p.file_id                                        AS fileId,
                COALESCE(p.document_name, fi.name, 'Unknown')     AS name,
                COUNT(*)                                          AS c
           FROM print_events p
           LEFT JOIN files fi ON fi.id = p.file_id
          ${where}
          GROUP BY COALESCE(p.file_id, -1), COALESCE(p.document_name, fi.name, 'Unknown')
          ORDER BY c DESC, name ASC
          LIMIT 5`,
        scopedParams
      )
      .map((row) => ({
        fileId: row.fileId === null ? null : Number(row.fileId),
        name: row.name ?? 'Unknown',
        count: Number(row.c)
      }))

    const recent = this.list({ limit: 8, studentId }).items

    return {
      folderCount: countOf('SELECT COUNT(*) AS c FROM folders'),
      fileCount: countOf('SELECT COUNT(*) AS c FROM files WHERE present = 1'),
      printCount: countOf(`SELECT COUNT(*) AS c FROM print_events p${where}`, scopedParams),
      printsToday,
      printsThisWeek,
      printsByDay,
      printsBySource,
      topFiles,
      recent
    }
  }
}
