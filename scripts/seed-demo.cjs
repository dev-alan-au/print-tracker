/**
 * Populates a throwaway userData directory with demo data, so the UI can be
 * reviewed with realistic content without touching the real database.
 *
 *   node scripts/seed-demo.cjs [targetDir]
 *   PT_DEBUG=1 PT_DEBUG_SHOT=/tmp/ui.png npx electron --user-data-dir=<targetDir> .
 *
 * The schema comes from src/main/db/schema.ts, so it cannot drift.
 */
const { readFileSync, rmSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

const PROJECT = join(__dirname, '..')
const { Database } = require(join(PROJECT, 'node_modules/node-sqlite3-wasm'))

const DIR = process.argv[2] ?? '/tmp/print-tracker-demo-data'
const HOME = process.env.HOME ?? process.env.USERPROFILE
const DEMO = join(HOME, 'print-tracker-demo')

rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })

const source = readFileSync(join(PROJECT, 'src/main/db/schema.ts'), 'utf8')

// Every migration, in order, rather than a hardcoded pair: this used to stop
// at v2, so the demo database was missing the v3 index and every launch had to
// migrate it. Comments are stripped first because one of them quotes a column
// name in backticks, which would otherwise be mistaken for a template literal.
const arrayText = source.match(/export const MIGRATIONS[^[]*\[([\s\S]*?)\n\]/)[1]
const migrations = [
  ...arrayText.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/`([\s\S]*?)`/g)
].map((match) => match[1])

const declared = Number(source.match(/SCHEMA_VERSION\s*=\s*(\d+)/)[1])
if (migrations.length !== declared) {
  throw new Error(
    `Parsed ${migrations.length} migrations but schema.ts declares ${declared}. ` +
      'The seeder needs updating.'
  )
}

const db = new Database(join(DIR, 'print-tracker.db'))
for (const migration of migrations) db.exec(migration)
db.exec(`PRAGMA user_version = ${declared}`)

const now = new Date().toISOString()
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()
const DAY = 86_400_000

const folder = (name, kind) => {
  const path = join(DEMO, name)
  db.run('INSERT INTO folders (path,name,kind,recursive,enabled,created_at) VALUES (?,?,?,?,1,?)', [
    path,
    name,
    kind,
    1,
    now
  ])
  return db.get('SELECT id FROM folders WHERE path = ?', [path]).id
}

const file = (folderId, name, ext, size, prints, lastPrinted) => {
  const path = join(DEMO, folderId === libId ? 'library' : 'output', name)
  db.run(
    `INSERT INTO files (folder_id,path,name,ext,size,mtime,present,first_seen_at,last_seen_at,printed_count,last_printed_at)
     VALUES (?,?,?,?,?,?,1,?,?,?,?)`,
    [folderId, path, name, ext, size, iso(DAY), iso(DAY), now, prints, lastPrinted]
  )
  return db.get('SELECT id FROM files WHERE path = ?', [path]).id
}

const studentIds = new Map()
const student = (name) => {
  if (studentIds.has(name)) return studentIds.get(name)
  db.run('INSERT INTO students (name, created_at) VALUES (?, ?)', [name, now])
  const id = db.get('SELECT id FROM students WHERE name = ?', [name]).id
  studentIds.set(name, id)
  return id
}

// The student is the last argument so the call sites below read as "...and this
// was theirs", and stay skippable for prints nobody was signed in for.
const event = (
  fileId,
  source2,
  printer,
  doc,
  copies,
  pages,
  user,
  noteKey,
  noteParams,
  msAgo,
  studentName
) => {
  db.run(
    `INSERT INTO print_events (file_id,source,printer,document_name,copies,pages,user_name,status,note,note_key,note_params,printed_at,created_at,student_id,student_name)
     VALUES (?,?,?,?,?,?,?,'Printed',NULL,?,?,?,?,?,?)`,
    [
      fileId,
      source2,
      printer,
      doc,
      copies,
      pages,
      user,
      noteKey,
      noteParams,
      iso(msAgo),
      now,
      studentName ? student(studentName) : null,
      studentName ?? null
    ]
  )
}

const libId = folder('library', 'library')
const outId = folder('output', 'output')

const invoiceId = file(libId, 'invoice-001.pdf', 'pdf', 184_320, 3, iso(3_600_000))
file(libId, 'service-contract.pdf', 'pdf', 94_208, 0, null)
const reportId = file(libId, 'reports/quarterly-report.docx', 'docx', 512_000, 1, iso(7_200_000))
const priceListId = file(libId, 'price-list.xlsx', 'xlsx', 27_648, 0, null)
const checklistId = file(libId, 'onboarding-checklist.docx', 'docx', 40_960, 0, null)
file(outId, 'previous-job.pdf', 'pdf', 30_720, 0, null)

// Two students with genuinely different histories, so switching between them
// visibly changes the overview, the file list and the history.
event(invoiceId, 'manual', 'HP LaserJet M404', 'invoice-001.pdf', 2, 4, 'alice', null, null, 3_600_000, 'Lena')
event(invoiceId, 'manual', 'HP LaserJet M404', 'invoice-001.pdf', 1, 2, 'alice', null, null, 5_400_000, 'Lena')
event(reportId, 'spooler', 'Microsoft Print to PDF', 'quarterly-report.docx', 1, 12, 'bob', 'note.spoolerEventLog', null, 7_200_000, 'Lena')

event(invoiceId, 'manual', 'Brother HL-L2350', 'invoice-001.pdf', 1, 2, 'dave', null, null, DAY, 'Marco')
event(priceListId, 'manual', 'Brother HL-L2350', 'price-list.xlsx', 1, 3, 'dave', null, null, 14_400_000, 'Marco')
event(checklistId, 'manual', 'Brother HL-L2350', 'onboarding-checklist.docx', 2, 6, 'dave', null, null, 21_600_000, 'Marco')
event(null, 'spooler', 'HP LaserJet M404', 'unknown-scan.pdf', 1, 1, 'carol', 'note.spoolerQueue', null, 1_800_000, 'Marco')

// Detected in the output folder with nobody signed in: history keeps these
// without a name, which is the case the nullable student exists for.
event(null, 'watcher', null, 'posted-poster.pdf', 1, null, null, 'note.outputNewFile', '{"folder":"output"}', 900_000, null)

// The per-file counters are denormalised totals, so derive them from the events
// rather than hand-maintaining them. They are what the unscoped view reads; the
// per-student view counts the events itself.
db.run(`UPDATE files SET
          printed_count = (SELECT COUNT(*) FROM print_events p WHERE p.file_id = files.id),
          last_printed_at = (SELECT MAX(printed_at) FROM print_events p WHERE p.file_id = files.id)`)

db.close()
console.log(`seeded demo data into ${DIR}`)
