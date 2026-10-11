/**
 * Throwaway verification harness.
 *
 * Exercises `node-sqlite3-wasm` against the *real* migration SQL from
 * src/main/db/schema.ts and against the exact query shapes used by the
 * services, so driver/API surprises surface without launching Electron.
 */
const { readFileSync, rmSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { Database } = require('node-sqlite3-wasm')

const ROOT = '/tmp/pt-smoke'
rmSync(ROOT, { recursive: true, force: true })
mkdirSync(ROOT, { recursive: true })

const results = []
function check(name, fn) {
  try {
    fn()
    results.push(`PASS  ${name}`)
  } catch (error) {
    results.push(`FAIL  ${name}\n        ${error.message}`)
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
}

// --- pull the real schema straight out of the TypeScript source -------------
const schemaSource = readFileSync(join(__dirname, '..', 'src/main/db/schema.ts'), 'utf8')
const schemaMatch = schemaSource.match(/\/\* v0 -> v1 : initial schema \*\/\s*`([\s\S]*?)`/)
assert(schemaMatch, 'could not extract migration SQL from schema.ts')
const SCHEMA_SQL = schemaMatch[1]

const v2Match = schemaSource.match(/\/\* v1 -> v2 :[\s\S]*?\*\/\s*`([\s\S]*?)`/)
assert(v2Match, 'could not extract the v1 -> v2 migration from schema.ts')
const SCHEMA_V2_SQL = v2Match[1]

const dbPath = join(ROOT, 'print-tracker.db')
const db = new Database(dbPath)

check('journal_mode WAL is accepted (or degrades gracefully)', () => {
  try {
    db.exec('PRAGMA journal_mode = WAL;')
  } catch {
    /* VFS may not implement WAL - the Db wrapper swallows this */
  }
})
check('foreign_keys pragma', () => db.exec('PRAGMA foreign_keys = ON;'))

check('real migration SQL executes', () => db.exec(SCHEMA_SQL))

check('PRAGMA user_version round-trip via db.get', () => {
  const before = db.get('PRAGMA user_version')
  assertEqual(Number(before.user_version), 0, 'initial user_version')
  db.exec('PRAGMA user_version = 1')
  assertEqual(Number(db.get('PRAGMA user_version').user_version), 1, 'after set')
})

check('transaction commits', () => {
  db.exec('BEGIN')
  db.run('INSERT INTO folders (path, name, kind, recursive, enabled) VALUES (?,?,?,?,?)', [
    '/tmp/lib',
    'lib',
    'library',
    1,
    1
  ])
  db.exec('COMMIT')
  assertEqual(db.all('SELECT COUNT(*) AS c FROM folders')[0].c, 1, 'folder count')
})

check('transaction rolls back on error', () => {
  db.exec('BEGIN')
  db.run('INSERT INTO folders (path, name, kind, recursive, enabled) VALUES (?,?,?,?,?)', [
    '/tmp/rollback',
    'rollback',
    'library',
    1,
    1
  ])
  db.exec('ROLLBACK')
  assertEqual(db.all('SELECT COUNT(*) AS c FROM folders')[0].c, 1, 'folder count unchanged')
})

check('folders.path UNIQUE rejects duplicates', () => {
  let threw = false
  try {
    db.run('INSERT INTO folders (path, name) VALUES (?,?)', ['/tmp/lib', 'lib-again'])
  } catch {
    threw = true
  }
  assert(threw, 'expected a UNIQUE constraint violation')
})

check('ON CONFLICT upsert updates the row', () => {
  db.run(
    `INSERT INTO folders (path, name, kind, recursive, enabled)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, recursive = excluded.recursive, enabled = 1`,
    ['/tmp/lib', 'lib', 'output', 0]
  )
  const row = db.get('SELECT kind, recursive, enabled FROM folders WHERE path = ?', ['/tmp/lib'])
  assertEqual({ kind: row.kind, recursive: row.recursive, enabled: row.enabled }, {
    kind: 'output',
    recursive: 0,
    enabled: 1
  }, 'updated folder')
})

const folderId = db.get('SELECT id FROM folders WHERE path = ?', ['/tmp/lib']).id

check('files upsert + AUTOINCREMENT lastInsertRowid is numeric', () => {
  const info = db.run(
    `INSERT INTO files (folder_id, path, name, ext, size, mtime, present, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [folderId, '/tmp/lib/a.pdf', 'a.pdf', 'pdf', 10, '2026-10-11T00:00:00.000Z', 'x', 'x']
  )
  assert(Number.isFinite(Number(info.lastInsertRowid)), 'lastInsertRowid must be coercible to Number')
  assertEqual(Number(info.changes), 1, 'changes')
})

check('NULL external_id values do not collide in the unique index', () => {
  const insert = (doc) =>
    db.run(
      `INSERT INTO print_events (file_id, source, document_name, copies, printed_at, created_at)
       VALUES (NULL, 'manual', ?, 1, ?, ?)`,
      [doc, '2026-10-11T01:00:00.000Z', '2026-10-11T01:00:00.000Z']
    )
  insert('one')
  insert('two')
  insert('three')
  assertEqual(db.all('SELECT COUNT(*) AS c FROM print_events')[0].c, 3, 'three manual events')
})

check('duplicate external_id is rejected', () => {
  const insert = () =>
    db.run(
      `INSERT INTO print_events (source, document_name, copies, external_id, printed_at, created_at)
       VALUES ('spooler', 'x', 1, 'spooler:event:42', ?, ?)`,
      ['2026-10-11T01:00:00.000Z', '2026-10-11T01:00:00.000Z']
    )
  insert()
  let threw = false
  try {
    insert()
  } catch {
    threw = true
  }
  assert(threw, 'expected unique external_id violation')
})

check('LIKE ... ESCAPE works with escaped wildcards', () => {
  db.run(
    `INSERT INTO files (folder_id, path, name, ext, size, present, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 'txt', 1, 1, 'x', 'x')`,
    [folderId, '/tmp/lib/100%_report.txt', '100%_report.txt']
  )
  const hits = db.all(
    `SELECT name FROM files WHERE name LIKE ? ESCAPE '\\'`,
    ['%100\\%\\_%']
  )
  assertEqual(hits.length, 1, 'escaped wildcard match')
  assertEqual(hits[0].name, '100%_report.txt', 'matched name')
})

check('COLLATE NOCASE equality match works', () => {
  const row = db.get('SELECT id FROM files WHERE name = ? COLLATE NOCASE LIMIT 1', ['A.PDF'])
  assert(row, 'expected a case-insensitive match for A.PDF')
})

check('COALESCE(-1) grouping + ORDER BY alias works', () => {
  const rows = db.all(
    `SELECT COALESCE(p.document_name, fi.name, 'Unknown') AS name, COUNT(*) AS c
       FROM print_events p
       LEFT JOIN files fi ON fi.id = p.file_id
      GROUP BY COALESCE(p.file_id, -1), COALESCE(p.document_name, fi.name, 'Unknown')
      ORDER BY c DESC, name ASC
      LIMIT 5`
  )
  assert(rows.length > 0, 'expected grouped rows')
  assert(Number.isFinite(Number(rows[0].c)), 'count must be numeric')
})

check('subquery-based counter recalculation works', () => {
  const fileId = db.get('SELECT id FROM files WHERE name = ?', ['a.pdf']).id
  db.run(
    `INSERT INTO print_events (file_id, source, document_name, copies, printed_at, created_at)
     VALUES (?, 'manual', 'a.pdf', 1, ?, ?)`,
    [fileId, '2026-10-11T02:00:00.000Z', '2026-10-11T02:00:00.000Z']
  )
  db.run(
    `UPDATE files
        SET printed_count   = (SELECT COUNT(*) FROM print_events WHERE file_id = ?),
            last_printed_at = (SELECT MAX(printed_at) FROM print_events WHERE file_id = ?)
      WHERE id = ?`,
    [fileId, fileId, fileId]
  )
  const row = db.get('SELECT printed_count, last_printed_at FROM files WHERE id = ?', [fileId])
  assertEqual(Number(row.printed_count), 1, 'printed_count')
  assertEqual(row.last_printed_at, '2026-10-11T02:00:00.000Z', 'last_printed_at')
})

check('ON DELETE CASCADE removes files but keeps print history', () => {
  const before = Number(db.all('SELECT COUNT(*) AS c FROM print_events')[0].c)
  db.run('DELETE FROM folders WHERE id = ?', [folderId])
  assertEqual(db.all('SELECT COUNT(*) AS c FROM files')[0].c, 0, 'files cascaded')
  assertEqual(
    Number(db.all('SELECT COUNT(*) AS c FROM print_events')[0].c),
    before,
    'print history preserved'
  )
  const orphan = db.get('SELECT file_id FROM print_events WHERE document_name = ?', ['a.pdf'])
  assertEqual(orphan.file_id, null, 'file_id set to NULL')
})

check('settings key/value upsert works', () => {
  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['spoolerPollIntervalMs', '5000']
  )
  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['spoolerPollIntervalMs', '9000']
  )
  assertEqual(db.get('SELECT value FROM settings WHERE key = ?', ['spoolerPollIntervalMs']).value, '9000', 'value')
})

check('v1 -> v2 migration adds the note columns to an existing database', () => {
  const legacyPath = join(ROOT, 'legacy.db')
  const legacy = new Database(legacyPath)
  legacy.exec(SCHEMA_SQL)
  legacy.exec('PRAGMA user_version = 1')
  legacy.run(
    `INSERT INTO print_events (source, document_name, note, copies, printed_at, created_at)
     VALUES ('watcher', 'old.pdf', 'New file detected', 1, ?, ?)`,
    ['2026-10-11T00:00:00.000Z', '2026-10-11T00:00:00.000Z']
  )
  legacy.close()

  const upgraded = new Database(legacyPath)
  assertEqual(Number(upgraded.get('PRAGMA user_version').user_version), 1, 'starts at v1')

  upgraded.exec('BEGIN')
  upgraded.exec(SCHEMA_V2_SQL)
  upgraded.exec('PRAGMA user_version = 2')
  upgraded.exec('COMMIT')

  const columns = upgraded.all('PRAGMA table_info(print_events)').map((row) => row.name)
  assert(columns.includes('note_key'), 'note_key column missing')
  assert(columns.includes('note_params'), 'note_params column missing')
  assertEqual(Number(upgraded.get('PRAGMA user_version').user_version), 2, 'now at v2')

  // Pre-existing rows keep their plain-text note and simply have no key.
  const row = upgraded.get('SELECT note, note_key FROM print_events WHERE document_name = ?', [
    'old.pdf'
  ])
  assertEqual(row.note, 'New file detected', 'legacy note preserved')
  assertEqual(row.note_key, null, 'legacy note_key is null')

  upgraded.close()
})

check('database file exists on disk and reopens', () => {
  db.close()
  assert(readFileSync(dbPath).length > 0, 'database file should not be empty')
  const reopened = new Database(dbPath)
  assertEqual(
    Number(reopened.all('SELECT COUNT(*) AS c FROM settings')[0].c),
    1,
    'settings survived reopen'
  )
  reopened.close()
})

console.log(results.join('\n'))
const failures = results.filter((line) => line.startsWith('FAIL'))
console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
process.exit(failures.length === 0 ? 0 : 1)
