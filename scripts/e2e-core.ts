/**
 * End-to-end check of the core services, run without Electron.
 *
 * Bundled with esbuild and executed on plain Node, using the real
 * FolderService / FileService / PrintService / WatcherService against a
 * throwaway directory tree.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { Database } from 'node-sqlite3-wasm'
import { Db } from '../src/main/db/database'
import { FILE_NOTES_MAX_LENGTH } from '../src/shared/types'
import { BackupService } from '../src/main/services/backups'
import { FileService } from '../src/main/services/files'
import { FolderService } from '../src/main/services/folders'
import { PrintService } from '../src/main/services/prints'
import { parseWindowsPrinters, PrinterService } from '../src/main/services/printer'
import { QueryService } from '../src/main/services/query'
import { ResetService } from '../src/main/services/reset'
import { RestoreService } from '../src/main/services/restore'
import { SettingsService } from '../src/main/services/settings'
import { SpoolerService } from '../src/main/services/spooler'
import { StudentService } from '../src/main/services/students'
import { WatcherService } from '../src/main/services/watcher'

const ROOT = '/tmp/pt-e2e'
rmSync(ROOT, { recursive: true, force: true })

const library = join(ROOT, 'library')
const output = join(ROOT, 'output')
mkdirSync(join(library, 'nested'), { recursive: true })
mkdirSync(output, { recursive: true })

// Pre-existing content, used to prove the initial scan does not fabricate prints.
writeFileSync(join(library, 'invoice-a.pdf'), 'a')
writeFileSync(join(library, 'nested', 'report-b.docx'), 'b')
writeFileSync(join(output, 'old-job.pdf'), 'old')

const results: string[] = []
const failures: string[] = []

function check(name: string, fn: () => void): void {
  try {
    fn()
    results.push(`PASS  ${name}`)
  } catch (error) {
    const line = `FAIL  ${name}\n        ${(error as Error).message}`
    results.push(line)
    failures.push(line)
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

/**
 * Async twin of `check`. Printing talks to the operating system, so those
 * checks have to await; a rejected promise returned from the sync `check`
 * would never be counted and the failure would vanish.
 */
async function acheck(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push(`PASS  ${name}`)
  } catch (error) {
    const line = `FAIL  ${name}\n        ${(error as Error).message}`
    results.push(line)
    failures.push(line)
  }
}

function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await sleep(100)
  }
}

async function main(): Promise<void> {
  const db = new Db(join(ROOT, 'print-tracker.db'))
  const folders = new FolderService(db)
  const files = new FileService(db)
  const prints = new PrintService(db)
  const settings = new SettingsService(db)

  const watcher = new WatcherService(folders, files, prints, () => settings.get(), {
    onFilesChanged: () => undefined,
    onPrintRecorded: () => undefined
  })

  /* ---------------------------------------------------------- indexing */

  const lib = folders.add({ path: library, kind: 'library' })
  check('recursive scan indexes existing files', () => eq(files.scanFolder(lib), 2, 'indexed'))
  check('files list returns indexed rows', () => eq(files.list({}).total, 2, 'total'))
  check('nested file is indexed', () => eq(files.list({ search: 'report-b' }).total, 1, 'nested'))
  check('document name lookup is case-insensitive', () =>
    assert(files.findByDocumentName('INVOICE-A.PDF'), 'expected a match'))
  check('document lookup falls back to the stem', () =>
    assert(files.findByDocumentName('report-b'), 'expected a stem match'))

  const out = folders.add({ path: output, kind: 'output' })
  check('output folder scan indexes its file', () => eq(files.scanFolder(out), 1, 'indexed'))

  /* -------------------------------------------------- folder and subfolder */

  check('a watched folder filter already covers its subdirectories', () => {
    // Every file under a recursive folder shares its folder_id, so filtering by
    // the folder is enough to reach the nested files.
    const page = files.list({ folderId: lib.id })
    eq(page.total, 2, 'both the root and the nested file')
    assert(
      page.items.some((file) => file.path.includes('nested')),
      'expected the nested file to be included'
    )
  })

  check('subdirectories are listed with a relative label and a count', () => {
    const dirs = files.directories(lib.id)
    eq(dirs.length, 1, 'one subdirectory')
    eq(dirs[0].label, 'nested', 'label is relative to the watched folder')
    eq(dirs[0].fileCount, 1, 'files inside it')
    // The folder root is what the folder option covers, so it must not appear.
    assert(
      !dirs.some((entry) => entry.path === lib.path),
      'the watched folder itself is not a subdirectory'
    )
  })

  check('the global directory list is grouped by watched folder', () => {
    const dirs = files.directories()
    assert(
      dirs.every((entry) => entry.folderId === lib.id),
      'only the folder that has subdirectories should appear'
    )
  })

  check('scoping to a subdirectory excludes the folder root', () => {
    const nested = files.directories(lib.id)[0]
    const page = files.list({ directory: nested.path })
    eq(page.total, 1, 'only the nested file')
    eq(page.items[0].name, 'report-b.docx', 'the nested file')
  })

  // A tree of its own for the nesting and prefix cases. Adding to the shared
  // fixtures would change the counts that later checks assert, so this one is
  // built, used, and removed again.
  const tree = join(ROOT, 'tree')
  mkdirSync(join(tree, 'nested', 'deeper'), { recursive: true })
  mkdirSync(join(tree, 'nestedish'), { recursive: true })
  writeFileSync(join(tree, 'top.pdf'), 't')
  writeFileSync(join(tree, 'nested', 'mid.docx'), 'm')
  writeFileSync(join(tree, 'nested', 'deeper', 'deep.txt'), 'd')
  writeFileSync(join(tree, 'nestedish', 'trap.txt'), 'x')
  const treeFolder = folders.add({ path: tree, kind: 'library' })
  check('the tree fixture is indexed', () => eq(files.scanFolder(treeFolder), 4, 'indexed'))

  check('a subdirectory scope includes anything deeper below it', () => {
    // Proves the match is a path prefix rather than just the immediate parent.
    const nested = files.directories(treeFolder.id).find((entry) => entry.label === 'nested')
    assert(nested, 'expected the nested directory')

    const page = files.list({ directory: nested.path })
    eq(page.total, 2, 'both the direct and the deeper file')
    assert(page.items.some((file) => file.name === 'mid.docx'), 'the direct child')
    assert(page.items.some((file) => file.name === 'deep.txt'), 'the deeper child')
    eq(
      files
        .directories(treeFolder.id)
        .find((entry) => entry.label === join('nested', 'deeper'))?.fileCount,
      1,
      'the deeper directory is offered in its own right'
    )
  })

  check('a trailing separator on the scoped directory is tolerated', () => {
    const nested = files.directories(treeFolder.id).find((entry) => entry.label === 'nested')
    assert(nested, 'expected the nested directory')
    eq(
      files.list({ directory: `${nested.path}${sep}` }).total,
      2,
      'trailing separator ignored'
    )
  })

  check('a sibling directory sharing a prefix is not swept in', () => {
    // "nestedish" shares a prefix with "nested" but is a different directory.
    const nested = files.directories(treeFolder.id).find((entry) => entry.label === 'nested')
    assert(nested, 'expected the nested directory')

    const page = files.list({ directory: nested.path })
    eq(page.total, 2, 'the sibling must not be swept in')
    assert(
      !page.items.some((file) => file.name === 'trap.txt'),
      'a directory sharing a prefix is a different directory'
    )
  })

  // Leave the shared fixtures exactly as this block found them.
  folders.remove(treeFolder.id)
  check('the tree fixture is removed again', () => {
    eq(folders.list().length, 2, 'library and output only')
    eq(files.list({ search: 'deep' }).total, 0, 'and its files went with it')
  })

  /* ------------------------------------------------- watcher semantics */

  watcher.start()
  await sleep(3000) // let chokidar finish its initial pass and emit `ready`

  check('initial scan indexed the pre-existing output file', () =>
    eq(files.list({ search: 'old-job' }).total, 1, 'indexed'))
  check('initial scan records no phantom prints', () => eq(prints.count(), 0, 'print count'))

  /* ------------------------------- a new file in output == a print event */

  writeFileSync(join(output, 'printed-job.pdf'), 'x')
  await waitFor(() => prints.count() >= 1, 8000)

  check('file appearing in an output folder is recorded as a print', () => {
    const page = prints.list({})
    eq(page.total, 1, 'print count')
    eq(page.items[0].source, 'watcher', 'source')
    eq(page.items[0].fileName, 'printed-job.pdf', 'document name')
    assert(page.items[0].fileId !== null, 'print should link to the indexed file')
  })

  /* --------------------------- a new file in a library folder is not a print */

  writeFileSync(join(library, 'notes-c.txt'), 'c')
  await waitFor(() => files.list({ search: 'notes-c' }).total >= 1, 8000)

  check('file added to a library folder is indexed', () =>
    eq(files.list({ search: 'notes-c' }).total, 1, 'indexed'))
  check('library folders never create print events', () => eq(prints.count(), 1, 'print count'))

  /* ------------------------------------------------------- manual events */

  const invoice = files.list({ search: 'invoice-a' }).items[0]
  const manual = prints.addManual({ fileId: invoice.id, copies: 3, printer: 'HP LaserJet 4' })

  check('manual event links to the indexed file', () => eq(manual.fileId, invoice.id, 'fileId'))
  check('manual event stores copies and printer', () => {
    eq(manual.copies, 3, 'copies')
    eq(manual.printer, 'HP LaserJet 4', 'printer')
    eq(manual.source, 'manual', 'source')
  })
  check('file print counter increments', () => eq(files.get(invoice.id)?.printedCount, 1, 'printedCount'))
  check('print filters by source', () => eq(prints.list({ source: 'manual' }).total, 1, 'manual count'))

  /* ------------------------------------------- last printed is queryable */

  check('files can be ordered by when they were last printed', () => {
    const page = files.list({ sort: 'lastPrinted', direction: 'desc', limit: 10 })
    assert(page.items.length > 0, 'expected files')
    assert(
      page.items[0].lastPrintedAt !== null,
      'the most recently printed file should sort first'
    )
  })

  check('ordering by last printed puts never-printed files last', () => {
    const page = files.list({ sort: 'lastPrinted', direction: 'desc', limit: 10 })
    const last = page.items[page.items.length - 1]
    eq(last.lastPrintedAt, null, 'never-printed file sorts last')
  })

  /* ------------------------------------------------- search by folder */

  // Give one folder a display name that appears nowhere in its file paths, so a
  // hit can only come from the folder row itself.
  db.run('UPDATE folders SET name = ? WHERE id = ?', ['Client Reports', out.id])
  try {
    check('a file is found by its folder name alone', () => {
      const page = files.list({ search: 'client reports' })
      assert(page.total >= 1, 'expected a match driven by the folder name')
      eq(page.items.length, page.total, 'the page should hold every matching row')
    })

    check('folder-name search keeps the pagination total honest', () => {
      // The COUNT used to be assembled without the folders join, so any filter
      // touching fo.* failed with "no such column: fo.name".
      const page = files.list({ search: 'client reports', limit: 1 })
      assert(page.total >= 1, 'total must be computed with the folders join')
      eq(page.items.length, 1, 'limit should still apply to the page')
    })

    check('a search with no matches reports zero rather than the whole table', () => {
      const page = files.list({ search: 'definitely-not-a-tracked-file' })
      eq(page.total, 0, 'total')
      eq(page.items.length, 0, 'items')
    })
  } finally {
    db.run('UPDATE folders SET name = ? WHERE id = ?', ['output', out.id])
  }

  check('the printed and not-printed filters partition the file set', () => {
    // Both checkboxes resolve to this one field, so it has to be exhaustive and
    // non-overlapping or a file would show up in neither list, or in both.
    const all = files.list({}).total
    const printed = files.list({ printed: 'printed' })
    const unprinted = files.list({ printed: 'unprinted' })

    eq(printed.total + unprinted.total, all, 'every file lands in exactly one list')
    assert(
      printed.items.every((file) => file.printedCount > 0),
      'nothing unprinted in the printed list'
    )
    assert(
      unprinted.items.every((file) => file.printedCount === 0),
      'nothing printed in the unprinted list'
    )
    eq(files.list({}).total, all, 'and an unfiltered query is unaffected')
  })

  check('a wildcard in the search term is matched literally', () => {
    // Without escaping, "%" would become "%%%" and match every file.
    eq(files.list({ search: '%' }).total, 0, 'a bare % should not match everything')
    eq(files.list({ search: '_' }).total, 0, 'a bare _ should not match a single character')
  })

  check('search matches text that appears only in the path', () => {
    // 'pt-e2e' is the root these fixtures live under. It appears in no file name
    // and no folder name, so a match can only come from the path itself - which
    // is how a user name buried in C:\\Users\\... would be found.
    const all = files.list({}).total
    assert(all > 0, 'expected indexed files')
    eq(files.list({ search: 'pt-e2e' }).total, all, 'every file matches on its path')
  })

  check('search finds a Windows-style path by a mid-path fragment', () => {
    // Reproduces the reported case: the term is in the user name part of the
    // path, which never shows up in a file name or a watched folder name.
    db.run('INSERT INTO folders (id, path, name, kind) VALUES (?, ?, ?, ?)', [
      9001,
      'C:\\Users\\alan\\Documents',
      'Documents',
      'library'
    ])
    db.run('INSERT INTO files (id, folder_id, path, name, ext, size) VALUES (?, ?, ?, ?, ?, ?)', [
      9001,
      9001,
      'C:\\Users\\alan\\Documents\\quarterly.pdf',
      'quarterly.pdf',
      'pdf',
      10
    ])

    try {
      eq(files.list({ search: 'alan' }).total, 1, 'found by the user name in the path')
      eq(files.list({ search: 'ALAN' }).total, 1, 'and case-insensitively')
      // A single backslash, escaped for the SQL pattern under the hood, must
      // still match the single separator in the stored path.
      eq(files.list({ search: 'users\\alan' }).total, 1, 'and with the separator included')
      eq(files.list({ search: 'quarterly' }).total, 1, 'and by the file name as before')
    } finally {
      db.run('DELETE FROM files WHERE id = ?', [9001])
      db.run('DELETE FROM folders WHERE id = ?', [9001])
    }
  })

  /* ----------------------------------------------- spooler degradation */

  const spooler = new SpoolerService(files, prints, {
    onStatus: () => undefined,
    onPrintRecorded: () => undefined
  })
  const status = spooler.getStatus()
  check('spooler reports unsupported off Windows', () => {
    eq(status.supported, false, 'supported')
    assert(status.lastError, 'expected an explanatory message')
  })
  check('spooler start is a no-op when unsupported', () => eq(spooler.start().running, false, 'running'))
  const polled = await spooler.poll()
  check('spooler poll resolves without throwing when unsupported', () =>
    assert(polled.lastError !== null, 'expected lastError'))
  const printerList = await spooler.listPrinters()
  check('spooler printer list is empty when unsupported', () => eq(printerList, [], 'printers'))

  /* --------------------------------------------------------------- stats */

  const stats = prints.stats()
  check('stats: totals', () => {
    eq(stats.printCount, 2, 'printCount')
    eq(stats.fileCount, 5, 'fileCount')
    eq(stats.folderCount, 2, 'folderCount')
  })
  check('stats: today and week', () => {
    eq(stats.printsToday, 2, 'printsToday')
    eq(stats.printsThisWeek, 2, 'printsThisWeek')
  })
  check('stats: 14 day series is dense', () => eq(stats.printsByDay.length, 14, 'buckets'))
  check('stats: grouped by source', () => {
    eq(stats.printsBySource.find((s) => s.source === 'watcher')?.count, 1, 'watcher')
    eq(stats.printsBySource.find((s) => s.source === 'manual')?.count, 1, 'manual')
  })
  check('stats: most printed is populated', () =>
    assert(stats.topFiles.length >= 1, 'expected entries'))
  check('stats: recent activity is populated', () =>
    assert(stats.recent.length === 2, `expected 2 recent, got ${stats.recent.length}`))

  /* --------------------------------------------------- cascade behaviour */

  folders.remove(out.id)
  check('removing a folder drops its files but keeps history', () => {
    eq(folders.list().length, 1, 'remaining folders')
    eq(prints.count(), 2, 'history preserved')
  })

  prints.remove(manual.id)
  check('deleting a print recalculates the file counter', () =>
    eq(files.get(invoice.id)?.printedCount, 0, 'printedCount'))
  check('deleting a print leaves the other event intact', () => eq(prints.count(), 1, 'remaining'))

  /* ---------------------------------------------------------- settings */

  check('settings persist and merge with defaults', () => {
    const updated = settings.update({ minFileStabilityMs: 900 })
    eq(updated.minFileStabilityMs, 900, 'updated value')
    eq(updated.autoStartWatching, true, 'default preserved')
    eq(settings.get().minFileStabilityMs, 900, 'read back')
  })

  /* --------------------------------------------------------------- query */

  const query = new QueryService(db)

  check('the schema browser lists tables and their columns', () => {
    const schema = query.schema()
    eq(
      schema.map((table) => table.name).sort(),
      ['files', 'folders', 'print_events', 'settings', 'students'],
      'tables'
    )

    const filesTable = schema.find((table) => table.name === 'files')
    assert(filesTable, 'expected the files table')
    assert(
      filesTable.columns.some((column) => column.name === 'last_printed_at'),
      'expected last_printed_at to be listed'
    )
    assert(
      filesTable.columns.some((column) => column.primaryKey),
      'expected the primary key to be flagged'
    )
  })

  check('a select returns columns, rows and a rollback flag', () => {
    const result = query.run('SELECT name FROM files ORDER BY name', true)
    eq(result.columns, ['name'], 'columns')
    assert(result.rows.length > 0, 'expected rows')
    eq(result.rolledBack, true, 'read-only statements report a rollback')
  })

  check('read-only mode refuses a write and changes nothing', () => {
    let message = ''
    try {
      query.run('DELETE FROM files', true)
    } catch (error) {
      message = (error as Error).message
    }
    assert(message.includes('Read-only'), `expected a read-only refusal, got: ${message}`)
    assert(files.count() > 0, 'files should be untouched')
  })

  check('a write hidden behind a CTE cannot change anything', () => {
    const before = files.count()
    // The leading keyword is WITH, so the guard lets it through. The rollback is
    // what actually protects the data - which is the whole point of running
    // read-only statements inside a transaction.
    query.run('WITH x AS (SELECT 1) DELETE FROM files', true)
    eq(files.count(), before, 'files should be untouched')
  })

  check('write mode reports the number of affected rows', () => {
    const result = query.run("INSERT INTO settings (key, value) VALUES ('probe', '1')", false)
    eq(result.changes, 1, 'one row affected')
    eq(result.columns, [], 'a write returns no columns')
    query.run("DELETE FROM settings WHERE key = 'probe'", false)
  })

  check('several statements run together in write mode', () => {
    query.run(
      "INSERT INTO settings (key, value) VALUES ('multi1','1'); INSERT INTO settings (key, value) VALUES ('multi2','1');",
      false
    )
    const count = Number(
      db.get("SELECT COUNT(*) AS c FROM settings WHERE key LIKE 'multi%'").c
    )
    eq(count, 2, 'both statements ran')
    query.run("DELETE FROM settings WHERE key LIKE 'multi%'", false)
  })

  check('result cells are primitives React can render', () => {
    const result = query.run('SELECT id, name, present, last_printed_at FROM files LIMIT 1', true)
    assert(result.rows.length === 1, 'expected one row')
    for (const value of Object.values(result.rows[0])) {
      assert(
        value === null || typeof value === 'string' || typeof value === 'number',
        `unexpected cell type: ${typeof value}`
      )
    }
  })

  /* ---------------------------------------------------------- file notes */

  check('a file has no note until one is written', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    eq(file.notes, null, 'no note to begin with')
  })

  check('a note is stored and comes back on the file', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const updated = files.setNotes(file.id, '  Approved for archive  ')
    // Trimmed, because leading and trailing whitespace is never intentional in
    // a one-line admin note.
    eq(updated.notes, 'Approved for archive', 'stored trimmed')
    eq(files.get(file.id)?.notes, 'Approved for archive', 'and read back')
  })

  check('a note longer than the limit is cut, not rejected', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const updated = files.setNotes(file.id, 'x'.repeat(400))
    eq(updated.notes?.length, FILE_NOTES_MAX_LENGTH, 'truncated to the limit')
  })

  check('a blank note clears it rather than storing whitespace', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const updated = files.setNotes(file.id, '   ')
    eq(updated.notes, null, 'cleared')
  })

  check('writing a note needs the file to exist', () => {
    let threw = false
    try {
      files.setNotes(999_999, 'orphan')
    } catch {
      threw = true
    }
    assert(threw, 'expected a refusal for an unknown file')
  })

  check('notes survive a rescan of the folder', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    files.setNotes(file.id, 'keep me')
    files.scanFolder(folders.get(file.folderId)!)
    // The upsert updates the filesystem-derived columns; the note is not one of
    // them, and losing it on every scan would make the feature useless.
    eq(files.get(file.id)?.notes, 'keep me', 'note intact after a scan')
    files.setNotes(file.id, '')
  })

  /* ------------------------------------------------------------- backups */

  const backups = new BackupService(db, join(ROOT, 'backups'))

  check('a backup is a complete, reopenable snapshot', () => {
    const entry = backups.create('manual')
    assert(existsSync(entry.path), 'backup file should exist')
    assert(entry.size > 0, 'backup should not be empty')

    const copy = new Database(entry.path, { readOnly: true })
    eq(Number(copy.get('SELECT COUNT(*) AS c FROM folders').c), 1, 'folders in the backup')
    eq(Number(copy.get('SELECT COUNT(*) AS c FROM print_events').c), 1, 'events in the backup')
    eq(Number(copy.get('PRAGMA user_version').user_version), 5, 'schema version in the backup')
    copy.close()
  })

  check('backups are listed newest first', () => {
    const second = backups.create('manual')
    const list = backups.list()
    assert(list.length >= 2, `expected two backups, got ${list.length}`)
    eq(list[0].name, second.name, 'the newest backup is first')
  })

  check('an unchanged database is not snapshotted again', () => {
    // The checks above just took a manual snapshot, so nothing has moved since.
    // A snapshot per launch would otherwise spend all ten slots on identical
    // copies of an idle database.
    eq(backups.hasChangedSinceLastSnapshot(), false, 'it knows nothing changed')
    eq(backups.createOnLaunch(), null, 'so no launch snapshot is written')
  })

  check('a change is picked up by the next launch snapshot', () => {
    prints.addManual({ documentName: 'changed-since-the-snapshot' })
    eq(backups.hasChangedSinceLastSnapshot(), true, 'the change is detected')

    const entry = backups.createOnLaunch()
    assert(entry, 'expected a launch backup once something changed')
    eq(backups.hasChangedSinceLastSnapshot(), false, 'and it is up to date afterwards')
  })

  check('rescanning alone does not count as a change', () => {
    // last_seen_at churn touches every row without changing anything a snapshot
    // needs to preserve, so it must not qualify as a change.
    db.run('UPDATE files SET last_seen_at = ?', [new Date().toISOString()])
    eq(backups.hasChangedSinceLastSnapshot(), false, 'churn is not a change')
  })

  check('no more than ten snapshots are kept, newest first', () => {
    for (let index = 0; index < 14; index++) {
      prints.addManual({ documentName: `prune-probe-${index}` })
      backups.create('manual')
    }

    const list = backups.list()
    eq(list.length, 10, 'pruned to the limit')
    // Pruning must drop the oldest. If it kept the wrong end, the survivors
    // would still number ten while losing everything recent.
    const newest = backups.create('manual')
    const after = backups.list()
    eq(after.length, 10, 'still capped after another snapshot')
    eq(after[0].name, newest.name, 'and the newest one is at the top')
    assert(
      !after.some((entry) => entry.name === list[list.length - 1].name),
      'the oldest of the previous ten was the one dropped'
    )
  })

  check('deleting a backup removes only that file', () => {
    const before = backups.list()
    backups.remove(before[0].path)
    eq(backups.list().length, before.length - 1, 'one fewer backup')
    assert(!existsSync(before[0].path), 'the file should be gone')
  })

  check('deleting outside the backup directory is refused', () => {
    let threw = false
    try {
      backups.remove(join(ROOT, 'print-tracker.db'))
    } catch {
      threw = true
    }
    assert(threw, 'expected the service to refuse')
  })

  /* ------------------------------------------------------------- restore */

  const restore = new RestoreService(db, backups)
  const countAll = () => ({
    folders: Number(db.get('SELECT COUNT(*) AS c FROM folders').c),
    files: Number(db.get('SELECT COUNT(*) AS c FROM files').c),
    prints: Number(db.get('SELECT COUNT(*) AS c FROM print_events').c)
  })

  const goodSnapshot = backups.create('manual')
  const goodCounts = countAll()

  check('a healthy snapshot passes the file check', () => {
    const inspection = restore.inspect(goodSnapshot.path)
    eq(inspection.problems, [], 'problems')
    assert(inspection.ok, 'expected the snapshot to be restorable')
    eq(inspection.counts, goodCounts, 'reported counts')
    eq(inspection.schemaVersion, 5, 'schema version of the candidate')
    eq(inspection.supportedVersion, 5, 'schema version this build supports')
    assert(inspection.sizeBytes > 0, 'size')
  })

  check('the check leaves the candidate file untouched', () => {
    // Inspecting attaches the file read-only in spirit only, so prove the file
    // really is byte-for-byte identical afterwards.
    const before = readFileSync(goodSnapshot.path)
    restore.inspect(goodSnapshot.path)
    assert(readFileSync(goodSnapshot.path).equals(before), 'the file was modified by the check')
  })

  check('restore replaces the data and keeps a way back', () => {
    prints.addManual({ documentName: 'after-the-snapshot' })
    eq(countAll().prints, goodCounts.prints + 1, 'the probe print was recorded')

    const report = restore.restore(goodSnapshot.path)

    eq(report.restored, goodCounts, 'the report describes what was restored')
    eq(countAll(), goodCounts, 'live counts match the snapshot')
    eq(prints.list({ search: 'after-the-snapshot' }).total, 0, 'the probe print was replaced')
    assert(report.backup, 'expected a snapshot of the replaced data')

    // The snapshot taken just before the restore must contain what was lost,
    // otherwise calling the restore reversible would be a lie.
    const copy = new Database(report.backup.path, { readOnly: true })
    eq(
      Number(
        copy.get(
          "SELECT COUNT(*) AS c FROM print_events WHERE document_name = 'after-the-snapshot'"
        ).c
      ),
      1,
      'the replaced data is recoverable'
    )
    copy.close()
  })

  check('restore leaves no dangling references behind', () => {
    eq(db.all('PRAGMA foreign_key_check'), [], 'foreign key violations')
  })

  check('restore rewinds the id counters to the restored rows', () => {
    const maxId = Number(db.get('SELECT MAX(id) AS m FROM folders').m)
    // FolderService only tracks directories that exist.
    mkdirSync(join(ROOT, 'restore-probe'), { recursive: true })
    const folder = folders.add({ path: join(ROOT, 'restore-probe'), kind: 'library' })
    eq(folder.id, maxId + 1, 'the next folder continues after the restored ids')
    folders.remove(folder.id)
  })

  check('restoring a snapshot from an older build fills in what it lacks', () => {
    // Drop the v2 columns from a copy: a snapshot taken before they existed
    // must still restore, with the new columns left at their defaults.
    const file = join(ROOT, 'legacy.db')
    copyFileSync(goodSnapshot.path, file)
    const legacy = new Database(file)
    legacy.exec('ALTER TABLE print_events DROP COLUMN note_key')
    legacy.exec('ALTER TABLE print_events DROP COLUMN note_params')
    legacy.exec('PRAGMA user_version = 2')
    legacy.close()

    const inspection = restore.inspect(file)
    eq(inspection.problems, [], 'an older snapshot should be accepted')
    eq(inspection.schemaVersion, 2, 'reported version')

    eq(restore.restore(file).restored, goodCounts, 'restored counts')
    eq(countAll(), goodCounts, 'the data came back')
    const note = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM print_events WHERE note_key IS NULL')
    eq(Number(note?.n), goodCounts.prints, 'the new columns defaulted to null')
  })

  /* ------------------------------------- candidates that must be refused */

  check('a missing file is reported rather than thrown', () => {
    const inspection = restore.inspect(join(ROOT, 'does-not-exist.db'))
    eq(inspection.problems, ['missing'], 'problems')
    assert(!inspection.ok, 'not restorable')
  })

  check('a directory is not a restorable file', () => {
    const inspection = restore.inspect(ROOT)
    eq(inspection.problems, ['notAFile'], 'problems')
  })

  check('an empty file is rejected before it is opened', () => {
    const file = join(ROOT, 'empty.db')
    writeFileSync(file, '')
    eq(restore.inspect(file).problems, ['empty'], 'problems')
  })

  check('a file that is not a database is rejected', () => {
    const file = join(ROOT, 'not-a-db.db')
    writeFileSync(file, 'plain text pretending to be a snapshot')
    eq(restore.inspect(file).problems, ['notADatabase'], 'problems')
  })

  check('the live database cannot be restored over itself', () => {
    // Attaching the live file and then clearing it would delete the very rows
    // the copy was meant to read.
    eq(restore.inspect(db.file).problems, ['sameFile'], 'problems')
  })

  check('a database without the expected tables is rejected', () => {
    const file = join(ROOT, 'partial.db')
    const other = new Database(file)
    other.exec('CREATE TABLE folders (id INTEGER PRIMARY KEY, path TEXT, name TEXT)')
    other.close()

    const inspection = restore.inspect(file)
    assert(inspection.problems.includes('missingTables'), 'expected missingTables')
    eq(inspection.missingTables, ['files', 'print_events', 'settings'], 'missing tables')
  })

  check('a snapshot from a newer build is refused', () => {
    const file = join(ROOT, 'future.db')
    copyFileSync(goodSnapshot.path, file)
    const future = new Database(file)
    future.exec('PRAGMA user_version = 99')
    future.close()

    const inspection = restore.inspect(file)
    assert(inspection.problems.includes('newerSchema'), 'expected newerSchema')
    eq(inspection.schemaVersion, 99, 'reported version')
    eq(inspection.supportedVersion, 5, 'supported version')
  })

  check('a truncated database is reported as unreadable', () => {
    const file = join(ROOT, 'truncated.db')
    copyFileSync(goodSnapshot.path, file)
    // Keep the header, drop every page after the first: SQLite still believes
    // the file is a database, but its schema pointers now lead nowhere.
    writeFileSync(file, readFileSync(file).subarray(0, 4096))

    const inspection = restore.inspect(file)
    assert(!inspection.ok, 'a truncated file must not be restorable')
    assert(inspection.problems.length > 0, 'expected at least one problem')
  })

  check('restoring a rejected file changes nothing', () => {
    // The whole point of checking first: a bad candidate must be refused
    // before a single row is deleted.
    const before = countAll()
    let threw = false
    try {
      restore.restore(join(ROOT, 'not-a-db.db'))
    } catch {
      threw = true
    }
    assert(threw, 'expected the restore to refuse')
    eq(countAll(), before, 'nothing was touched')
  })

  check('the candidate is detached after a failed check', () => {
    // A still-attached candidate keeps a lock on the file, which on Windows
    // would stop the user deleting or overwriting their own file.
    const attached = db.all<{ name: string }>('PRAGMA database_list').map((row) => row.name)
    eq(attached, ['main'], 'only the live database should be attached')
  })

  /* ------------------------------------------------------------- printing */

  const printable = files.list({ search: 'invoice-a' }).items[0]
  assert(printable, 'expected the invoice fixture to be indexed')

  /** Stands in for the operating system: records the command, returns canned output. */
  const stub = (
    platform: NodeJS.Platform,
    respond: (file: string, args: string[]) => string = () => ''
  ): { service: PrinterService; calls: { file: string; args: string[] }[] } => {
    const calls: { file: string; args: string[] }[] = []
    const service = new PrinterService(files, prints, {
      platform,
      findBinary: (name) => (name === 'lp' || name === 'lpstat' ? `/usr/bin/${name}` : null),
      run: (file, args) => {
        calls.push({ file, args })
        return Promise.resolve(respond(file, args))
      }
    })
    return { service, calls }
  }

  await acheck('a machine without CUPS cannot print', () => {
    const bare = new PrinterService(files, prints, {
      platform: 'linux',
      findBinary: () => null,
      run: () => Promise.resolve('')
    })
    eq(bare.method(), 'unsupported', 'method')
  })

  await acheck('Windows prints through the shell, other platforms through CUPS', () => {
    eq(stub('win32').service.method(), 'windows', 'windows')
    eq(stub('linux').service.method(), 'cups', 'linux with lp')
    eq(stub('darwin').service.method(), 'cups', 'macOS with lp')
  })

  await acheck('printing a file queues it and records where it came from', async () => {
    const { service, calls } = stub('linux')
    const report = await service.print({ fileIds: [printable.id] })

    eq(report.method, 'cups', 'method')
    eq(report.results.length, 1, 'one result')
    eq(report.results[0].ok, true, 'queued')

    const call = calls.find((entry) => entry.file.endsWith('/lp'))
    assert(call, 'expected lp to be invoked')
    // `--` keeps a path starting with a dash from being read as an option.
    eq(call.args.at(-2), '--', 'path separator')
    eq(call.args.at(-1), printable.path, 'the file path')

    const events = prints.list({ fileId: printable.id }).items
    const event = events.find((item) => item.source === 'app')
    assert(event, 'expected an app-sourced print event')
    eq(event.printedAt >= new Date(Date.now() - 10_000).toISOString(), true, 'stamped now')
  })

  await acheck('copies are passed through to the print command', async () => {
    const { service, calls } = stub('linux')
    await service.print({ fileIds: [printable.id], copies: 3 })
    const call = calls.find((entry) => entry.file.endsWith('/lp'))
    assert(call, 'expected lp to be invoked')
    assert(call.args.includes('-n') && call.args.includes('3'), 'expected -n 3')
  })

  await acheck('a named printer is targeted', async () => {
    const { service, calls } = stub('linux')
    await service.print({ fileIds: [printable.id], printer: 'Office' })
    const call = calls.find((entry) => entry.file.endsWith('/lp'))
    assert(call, 'expected lp to be invoked')
    eq(call.args[0], '-d', 'printer flag')
    eq(call.args[1], 'Office', 'printer name')
  })

  await acheck('nothing is recorded when the print command fails', async () => {
    const before = prints.count()
    const { service } = stub('linux', () => {
      throw new Error('lp: The printer is not responding.')
    })
    const report = await service.print({ fileIds: [printable.id] })
    eq(report.results[0].ok, false, 'reported as failed')
    assert(report.results[0].error?.includes('not responding'), 'the OS message is surfaced')
    eq(prints.count(), before, 'no event for a job that never queued')
  })

  await acheck('a file that has vanished is refused before the OS is asked', async () => {
    const ghost = files.list({ search: 'invoice-a' }).items[0]
    const originalPath = ghost.path
    db.run('UPDATE files SET path = ? WHERE id = ?', [`${originalPath}.gone`, ghost.id])
    try {
      const { service, calls } = stub('linux')
      const report = await service.print({ fileIds: [ghost.id] })
      eq(report.results[0].errorKey, 'print.error.missing', 'reason')
      eq(calls.length, 0, 'the print command should not have run')
    } finally {
      // Put the path back even if the check fails: the rest of the suite reads it.
      db.run('UPDATE files SET path = ? WHERE id = ?', [originalPath, ghost.id])
    }
  })

  await acheck('an unsupported machine reports it per file rather than throwing', async () => {
    const bare = new PrinterService(files, prints, {
      platform: 'linux',
      findBinary: () => null,
      run: () => Promise.resolve('')
    })
    const report = await bare.print({ fileIds: [printable.id] })
    eq(report.method, 'unsupported', 'method')
    eq(report.results[0].errorKey, 'print.error.unsupported', 'reason')
  })

  await acheck('a batch reports per-file outcomes', async () => {
    // Written against call order rather than specific fixtures, so it does not
    // depend on which files earlier checks left in the index.
    let seen = 0
    const { service } = stub('linux', () => {
      seen += 1
      if (seen > 1) throw new Error('boom')
      return ''
    })
    const ids = files.list({ limit: 3 }).items.map((file) => file.id)
    assert(ids.length >= 2, 'expected at least two indexed files')

    const report = await service.print({ fileIds: ids })
    eq(report.results.length, ids.length, 'a result per file')
    eq(report.results.filter((result) => result.ok).length, 1, 'only one succeeded')
    eq(report.results[0].ok, true, 'results are in request order')
  })

  await acheck('Windows commands carry the file and printer, base64 encoded', async () => {
    const { service, calls } = stub('win32')
    return service
      .print({ fileIds: [printable.id], printer: 'HP LaserJet 4' })
      .then(() => {
        const call = calls[0]
        eq(call.file, 'powershell.exe', 'runner')
        assert(call.args.includes('-EncodedCommand'), 'encoded to avoid shell parsing')

        const decoded = Buffer.from(call.args.at(-1) ?? '', 'base64').toString('utf16le')
        assert(decoded.includes('PrintTo'), 'expected the PrintTo verb for a named printer')
        assert(decoded.includes('HP LaserJet 4'), 'expected the printer name')
        assert(decoded.includes(printable.path), 'expected the file path')
      })
  })

  await acheck('a Windows print to the default printer uses the plain print verb', async () => {
    const { service, calls } = stub('win32')
    return service.print({ fileIds: [printable.id] }).then(() => {
      const decoded = Buffer.from(calls[0].args.at(-1) ?? '', 'base64').toString('utf16le')
      assert(decoded.includes('-Verb Print'), 'expected the Print verb')
      assert(!decoded.includes('PrintTo'), 'PrintTo needs a printer name')
    })
  })

  await acheck('a quote in a Windows path cannot break out of the command', async () => {
    const { service, calls } = stub('win32')
    return service
      .print({ fileIds: [printable.id], printer: "Bob's 'Printer'" })
      .then(() => {
        const decoded = Buffer.from(calls[0].args.at(-1) ?? '', 'base64').toString('utf16le')
        // Doubling is what makes it inert; a single quote would end the string.
        assert(decoded.includes("'Bob''s ''Printer'''"), `expected doubled quotes, got: ${decoded}`)
      })
  })

  await acheck('the printer list marks the system default', async () => {
    const { service } = stub('linux', (file, args) => {
      if (args[0] === '-a') return 'HP_LaserJet accepting requests\nOffice accepting requests\n'
      if (args[0] === '-d') return 'system default destination: Office\n'
      return ''
    })
    return service.listPrinters().then((list) => {
      eq(list.length, 2, 'printers')
      eq(list.find((entry) => entry.isDefault)?.name, 'Office', 'default printer')
    })
  })

  await acheck('a printer list that cannot be read yields an empty list, not an error', async () => {
    const { service } = stub('linux', () => {
      throw new Error('lpstat: command not found')
    })
    return service.listPrinters().then((list) => eq(list, [], 'empty'))
  })

  await acheck('Windows printer output parses for one printer and for many', async () => {
    eq(parseWindowsPrinters('{"name":"Solo","default":true}'), [
      { name: 'Solo', isDefault: true }
    ], 'single object')
    eq(
      parseWindowsPrinters('[{"name":"A","default":false},{"name":"B","default":true}]').length,
      2,
      'array of objects'
    )
    eq(parseWindowsPrinters('not json'), [], 'garbage')
    eq(parseWindowsPrinters(''), [], 'empty')
  })

  /* ------------------------------------------- echoes of the app own prints */

  await acheck('a spooler event echoing an app print is suppressed', async () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const { service } = stub('linux')
    return service.print({ fileIds: [file.id] }).then(() => {
      const before = prints.count()
      // The spooler sees every job, including the one the app just queued.
      const echo = prints.record({
        fileId: file.id,
        source: 'spooler',
        externalId: 'spooler:echo-of-app-print'
      })
      eq(echo, null, 'the echo is dropped')
      eq(prints.count(), before, 'no second event')
    })
  })

  await acheck('a manual entry is never treated as an echo', async () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    // The user asserting a print outranks any inference from the app.
    const event = prints.record({ fileId: file.id, source: 'manual' })
    assert(event, 'a manual entry should always be recorded')
    eq(event?.source, 'manual', 'source')
  })

  await acheck('an echo from long ago no longer suppresses', async () => {
    // A file nothing else has printed from the app, so the only app-sourced
    // event for it is the stale one created here.
    const file = files.list({ search: 'report-b' }).items[0]
    assert(file, 'expected the nested report fixture')

    const old = new Date(Date.now() - 10 * 60_000).toISOString()

    // Clear anything an earlier check recorded from the app for this file, so
    // the stale event below is the only one and the window is what is tested.
    db.run("DELETE FROM print_events WHERE file_id = ? AND source = 'app'", [file.id])
    prints.record({ fileId: file.id, source: 'app', printedAt: old })

    const event = prints.record({
      fileId: file.id,
      source: 'spooler',
      externalId: 'spooler:outside-the-window'
    })
    assert(event, 'a stale app print should not swallow a later spooler event')
  })

  await acheck('an echo for a different file is not suppressed', async () => {
    const other = files.list({ search: 'notes-c' }).items[0]
    assert(other, 'expected the notes fixture')
    const event = prints.record({
      fileId: other.id,
      source: 'spooler',
      externalId: 'spooler:different-file'
    })
    assert(event, 'unrelated files must not be suppressed')
  })

  /* ------------------------------------------------------------ students */

  const students = new StudentService(db)
  /** A print service whose "who is using the app" can be moved about. */
  let currentStudentId: number | null = null
  const scopedPrints = new PrintService(db, () => currentStudentId)

  check('a student is just a name', () => {
    const added = students.add('  Alice   Smith  ')
    // Collapsed, because a name typed with stray spaces is still that name.
    eq(added.name, 'Alice Smith', 'whitespace normalised')
    eq(added.printCount, 0, 'nothing printed yet')
  })

  check('names are unique, ignoring case', () => {
    let threw = false
    try {
      students.add('alice smith')
    } catch {
      threw = true
    }
    assert(threw, 'Alice and alice would be indistinguishable in the picker')
  })

  check('a student needs a name', () => {
    let threw = false
    try {
      students.add('   ')
    } catch {
      threw = true
    }
    assert(threw, 'expected an empty name to be refused')
  })

  check('students are listed by name', () => {
    students.add('Bob')
    eq(
      students.list().map((student) => student.name),
      ['Alice Smith', 'Bob'],
      'sorted by name'
    )
  })

  check('renaming is refused when the name is taken', () => {
    const bob = students.list().find((student) => student.name === 'Bob')
    assert(bob, 'expected Bob')
    let threw = false
    try {
      students.rename(bob.id, 'alice smith')
    } catch {
      threw = true
    }
    assert(threw, 'expected the clash to be refused')
  })

  check('a print is attributed to whoever is using the app', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const alice = students.list().find((student) => student.name === 'Alice Smith')
    assert(alice, 'expected Alice')
    currentStudentId = alice.id

    const event = scopedPrints.addManual({ fileId: file.id, documentName: file.name })
    eq(event.studentId, alice.id, 'attributed to the current student')
    eq(event.studentName, 'Alice Smith', 'with the name captured alongside')
  })

  check('a print with nobody selected is attributed to nobody', () => {
    currentStudentId = null
    const event = scopedPrints.addManual({ documentName: 'printed-with-nobody-selected' })
    eq(event.studentId, null, 'no student')
    eq(event.studentName, null, 'and no name')
  })

  check('an explicit student overrides whoever is using the app', () => {
    const bob = students.list().find((student) => student.name === 'Bob')
    assert(bob, 'expected Bob')
    currentStudentId = null

    const event = scopedPrints.record({
      documentName: 'explicitly-bobs',
      source: 'manual',
      studentId: bob.id
    })
    eq(event?.studentId, bob.id, 'the explicit id wins')
  })

  check('the history can be filtered to one student', () => {
    const alice = students.list().find((student) => student.name === 'Alice Smith')
    assert(alice, 'expected Alice')

    const hers = scopedPrints.list({ studentId: alice.id })
    assert(hers.total > 0, 'expected at least one print')
    assert(
      hers.items.every((event) => event.studentId === alice.id),
      'nothing of anybody else is included'
    )
    assert(hers.total < scopedPrints.count(), 'and it is a subset of the whole history')
  })

  check('print figures are counted per student, not only in total', () => {
    const file = files.list({ search: 'invoice-a' }).items[0]
    const alice = students.list().find((student) => student.name === 'Alice Smith')
    const bob = students.list().find((student) => student.name === 'Bob')
    assert(alice && bob, 'expected both students')

    // Bob prints the file Alice already printed, so the two views must disagree.
    scopedPrints.record({ fileId: file.id, source: 'manual', documentName: file.name, studentId: bob.id })

    const globally = files.list({ search: 'invoice-a' }).items[0]
    const forAlice = files.list({ studentId: alice.id, search: 'invoice-a' }).items[0]
    const forBob = files.list({ studentId: bob.id, search: 'invoice-a' }).items[0]

    assert(
      globally.printedCount > forAlice.printedCount,
      'the global count includes both students'
    )
    eq(forAlice.printedCount, 1, 'Alice printed it once')
    eq(forBob.printedCount, 1, 'Bob printed it once')

    // Each student's timestamp must be their own latest, not the file's. Taken
    // from their history rather than compared between the two, which would be
    // a race on the clock when both prints land in the same millisecond.
    const aliceEvents = scopedPrints.list({ studentId: alice.id, fileId: file.id }).items
    eq(
      forAlice.lastPrintedAt,
      aliceEvents[0].printedAt,
      'Alice sees the time she printed it, not the newest overall'
    )
  })

  check('printed and not-printed follow the student', () => {
    const bob = students.list().find((student) => student.name === 'Bob')
    const nobody = students.add('Nobody Has Printed')
    assert(bob, 'expected Bob')

    const bobPrinted = files.list({ studentId: bob.id, printed: 'printed' }).total
    const nobodyPrinted = files.list({ studentId: nobody.id, printed: 'printed' }).total
    const nobodyUnprinted = files.list({ studentId: nobody.id, printed: 'unprinted' }).total

    eq(nobodyPrinted, 0, 'a new student has printed nothing')
    assert(bobPrinted > 0, 'Bob has printed something')
    assert(
      nobodyUnprinted > 0,
      'and everything is still unprinted for the student who has printed nothing'
    )

    // The two views partition the same rows, which is what the filter pair
    // relies on.
    eq(
      files.list({ studentId: nobody.id, printed: 'printed' }).total +
        nobodyUnprinted,
      files.list({ studentId: nobody.id }).total,
      'the pair covers every file for that student'
    )
    students.remove(nobody.id)
  })

  check('deleting a student keeps their prints and the name they had', () => {
    const bob = students.list().find((student) => student.name === 'Bob')
    assert(bob, 'expected Bob')
    const bobsPrints = scopedPrints.list({ studentId: bob.id }).total
    assert(bobsPrints > 0, 'expected Bob to have printed something')

    students.remove(bob.id)

    eq(scopedPrints.list({ studentId: bob.id }).total, 0, 'no longer attributed to Bob')
    eq(scopedPrints.count(), scopedPrints.count(), 'history is unchanged in size')

    const orphan = scopedPrints
      .list({})
      .items.find((event) => event.studentName === 'Bob' && event.studentId === null)
    assert(orphan, 'the print survives, detached, still saying who it was for')
  })

  check('a renamed student does not rewrite the past', () => {
    const alice = students.list().find((student) => student.name === 'Alice Smith')
    assert(alice, 'expected Alice')
    const before = scopedPrints.list({ studentId: alice.id }).items[0]
    assert(before?.studentName === 'Alice Smith', 'expected the original name')

    students.rename(alice.id, 'Alice Jones')

    // The event keeps the name it was printed under; the student row has moved
    // on. That is the point of denormalising it.
    const after = scopedPrints.list({ studentId: alice.id }).items[0]
    eq(after.studentName, 'Alice Smith', 'history keeps the name it recorded')
    eq(students.get(alice.id)?.name, 'Alice Jones', 'while the student is renamed')
  })

  /* --------------------------------------------------------------- reset */

  const reset = new ResetService(db, backups)

  check('reset preview counts what is at risk', () => {
    const preview = reset.preview()
    eq(preview.counts.folders, 1, 'folders')
    eq(preview.counts.files, files.list({}).total, 'files should match the list')
    assert(preview.counts.prints >= 1, 'expected print events')
    assert(preview.backups >= 1, 'expected backups')
    assert(preview.databasePath.endsWith('print-tracker.db'), 'database path')
  })

  check('reset with a backup first keeps a recoverable snapshot', () => {
    const before = reset.preview().counts
    const report = reset.reset({ backupFirst: true, removeBackups: false })

    eq(report.removed, before, 'the report echoes what was removed')
    eq(report.backupsRemoved, 0, 'existing snapshots were kept')
    assert(report.backup, 'expected a safety-net snapshot')

    // A safety net that does not contain the deleted rows is not a safety net.
    const copy = new Database(report.backup.path, { readOnly: true })
    eq(
      Number(copy.get('SELECT COUNT(*) AS c FROM folders').c),
      before.folders,
      'folders in the snapshot'
    )
    eq(
      Number(copy.get('SELECT COUNT(*) AS c FROM files').c),
      before.files,
      'files in the snapshot'
    )
    copy.close()
  })

  check('reset leaves no rows behind', () => {
    eq(reset.preview().counts, { folders: 0, files: 0, prints: 0 }, 'counts')
    eq(files.list({}).total, 0, 'file list')
    eq(prints.list({}).total, 0, 'print list')
    eq(files.count(), 0, 'present file count')
    // Students are part of "everything the app has saved", so a reset that left
    // them behind would be a reset that only looked complete.
    eq(students.list().length, 0, 'students are cleared too')
  })

  check('reset keeps the schema, so no migration is replayed', () => {
    // Rows are deleted rather than the file removed, so user_version and the
    // indexes must survive untouched.
    eq(Number(db.get('PRAGMA user_version')?.user_version ?? 0), 5, 'schema version')
    const index = db.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_files_last_printed'"
    )
    assert(index, 'expected idx_files_last_printed to still exist')
  })

  check('reset clears the row id counters', () => {
    const folder = folders.add({ path: library, kind: 'library' })
    eq(folder.id, 1, 'the first folder after a reset should be id 1')
    folders.remove(folder.id)
  })

  check('reset removes existing snapshots when asked, keeping the new one', () => {
    backups.create('manual')
    const before = backups.list().length
    assert(before >= 2, `expected at least 2 snapshots, got ${before}`)

    const report = reset.reset({ backupFirst: true, removeBackups: true })
    eq(report.backupsRemoved, before, 'every pre-existing snapshot was deleted')
    eq(backups.list().length, 1, 'only the safety-net snapshot remains')
    eq(backups.list()[0].path, report.backup?.path, 'and it is the freshly taken one')
  })

  check('reset without a backup leaves nothing to restore from', () => {
    const report = reset.reset({ backupFirst: false, removeBackups: true })
    eq(report.backup, null, 'no snapshot was requested')
    eq(backups.list().length, 0, 'and the older ones were removed')
  })

  check('settings fall back to their defaults after a reset', () => {
    const current = settings.get()
    eq(current.theme, 'light', 'theme')
    eq(current.language, 'system', 'language')
    eq(current.autoStartWatching, true, 'autoStartWatching')
  })

  watcher.stop()
  db.close()

  console.log(results.join('\n'))
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
  process.exit(failures.length === 0 ? 0 : 1)
}

void main().catch((error: unknown) => {
  console.error('harness crashed:', error)
  process.exit(1)
})
