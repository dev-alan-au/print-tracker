/**
 * End-to-end check of the core services, run without Electron.
 *
 * Bundled with esbuild and executed on plain Node, using the real
 * FolderService / FileService / PrintService / WatcherService against a
 * throwaway directory tree.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Db } from '../src/main/db/database'
import { FileService } from '../src/main/services/files'
import { FolderService } from '../src/main/services/folders'
import { PrintService } from '../src/main/services/prints'
import { SettingsService } from '../src/main/services/settings'
import { SpoolerService } from '../src/main/services/spooler'
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
