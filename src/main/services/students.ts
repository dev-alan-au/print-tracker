import { STUDENT_NAME_MAX_LENGTH, type Student } from '@shared/types'
import type { Db } from '../db/database'
import { nowIso } from '../util/time'

/** Names are the whole record, so keep them to something a person can read. */
const MAX_NAME_LENGTH = STUDENT_NAME_MAX_LENGTH

interface StudentRow {
  id: number
  name: string
  createdAt: string
  printCount: number
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    printCount: Number(row.printCount ?? 0)
  }
}

const SELECT_STUDENT = `
  SELECT s.id,
         s.name,
         s.created_at AS createdAt,
         (SELECT COUNT(*) FROM print_events p WHERE p.student_id = s.id) AS printCount
    FROM students s
`

/**
 * The people prints get attributed to.
 *
 * Deliberately thin: a name and nothing else. Anything more would turn a
 * classroom helper into a student information system, which is not what this is
 * for and carries obligations this app cannot meet.
 */
export class StudentService {
  constructor(private readonly db: Db) {}

  list(): Student[] {
    return this.db
      .all<StudentRow>(`${SELECT_STUDENT} ORDER BY s.name COLLATE NOCASE ASC`)
      .map(mapStudent)
  }

  get(id: number): Student | undefined {
    const row = this.db.get<StudentRow>(`${SELECT_STUDENT} WHERE s.id = ?`, [id])
    return row ? mapStudent(row) : undefined
  }

  /**
   * Names are compared case-insensitively by the schema, so "alice" when
   * "Alice" exists is reported as a duplicate rather than quietly creating a
   * second, indistinguishable entry in the picker.
   */
  private assertNameFree(name: string, exceptId?: number): void {
    const clash = this.db.get<{ id: number }>(
      'SELECT id FROM students WHERE name = ? COLLATE NOCASE AND id <> ?',
      [name, exceptId ?? -1]
    )
    if (clash) throw new Error(`There is already a student called "${name}".`)
  }

  private cleanName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
    if (!trimmed) throw new Error('A student needs a name.')
    return trimmed
  }

  add(name: string): Student {
    const clean = this.cleanName(name)
    this.assertNameFree(clean)

    const info = this.db.run('INSERT INTO students (name, created_at) VALUES (?, ?)', [
      clean,
      nowIso()
    ])
    return this.get(info.lastInsertRowid)!
  }

  rename(id: number, name: string): Student {
    const clean = this.cleanName(name)
    if (!this.get(id)) throw new Error('Student not found.')
    this.assertNameFree(clean, id)

    this.db.run('UPDATE students SET name = ? WHERE id = ?', [clean, id])
    // Existing history keeps the name it was printed under; renaming is not
    // meant to rewrite the past, and the denormalised name is what makes that
    // possible.
    return this.get(id)!
  }

  /**
   * Removes the student. Their print events survive with `student_id` set to
   * NULL by the schema, and still carry the name they were printed under, so
   * the history neither loses the print nor forgets who it was for.
   */
  remove(id: number): void {
    this.db.run('DELETE FROM students WHERE id = ?', [id])
  }

  count(): number {
    const row = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM students')
    return Number(row?.c ?? 0)
  }
}
