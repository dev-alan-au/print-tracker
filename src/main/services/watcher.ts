import { statSync } from 'node:fs'
import { basename } from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import type { AppSettings, PrintEvent, TrackedFolder } from '@shared/types'
import type { FileService } from './files'
import type { FolderService } from './folders'
import type { PrintService } from './prints'

export interface WatcherCallbacks {
  onFilesChanged(): void
  onPrintRecorded(event: PrintEvent): void
}

function isIgnoredPath(target: string): boolean {
  const name = basename(target)
  if (!name) return false
  if (name.startsWith('.')) return true
  if (name.startsWith('~$')) return true
  if (name.endsWith('.tmp') || name.endsWith('.crdownload') || name.endsWith('.part')) return true
  return name === 'Thumbs.db' || name === 'desktop.ini'
}

/**
 * Watches every enabled folder with chokidar.
 *
 * Folders marked as `output` are treated as print destinations: a file that
 * appears (or is replaced) there *after* the initial scan is recorded as a
 * print event. The initial pass only builds the index, otherwise every restart
 * would fabricate a print for each existing file.
 */
export class WatcherService {
  private readonly watchers = new Map<number, FSWatcher>()
  private readonly ready = new Set<number>()

  constructor(
    private readonly folders: FolderService,
    private readonly files: FileService,
    private readonly prints: PrintService,
    private readonly getSettings: () => AppSettings,
    private readonly callbacks: WatcherCallbacks
  ) {}

  get watchingCount(): number {
    return this.watchers.size
  }

  start(): void {
    this.stop()
    for (const folder of this.folders.listEnabled()) {
      this.watch(folder)
    }
  }

  /** Rebuilds every watcher; call after folders are added, changed or removed. */
  refresh(): void {
    this.start()
  }

  stop(): void {
    for (const watcher of this.watchers.values()) {
      void watcher.close()
    }
    this.watchers.clear()
    this.ready.clear()
  }

  private watch(folder: TrackedFolder): void {
    const stability = Math.max(200, this.getSettings().minFileStabilityMs)

    const watcher = chokidar.watch(folder.path, {
      depth: folder.recursive ? undefined : 0,
      ignoreInitial: false,
      persistent: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: stability,
        pollInterval: Math.min(200, stability)
      },
      ignored: (target: string) => isIgnoredPath(target)
    })

    watcher.on('add', (filePath: string) => this.handleFile(folder, filePath, true))
    watcher.on('change', (filePath: string) => this.handleFile(folder, filePath, false))
    watcher.on('unlink', (filePath: string) => {
      this.files.markMissingByPath(filePath)
      this.callbacks.onFilesChanged()
    })
    watcher.on('error', () => {
      /* A transient FS error (e.g. a locked file) must not kill the watcher. */
    })
    watcher.on('ready', () => {
      this.ready.add(folder.id)
      this.callbacks.onFilesChanged()
    })

    this.watchers.set(folder.id, watcher)
  }

  private handleFile(folder: TrackedFolder, filePath: string, isAdd: boolean): void {
    const result = this.files.upsertPath(folder.id, filePath)
    if (!result) return

    const isPrintCandidate = isAdd || !result.isNew
    if (isPrintCandidate && this.ready.has(folder.id) && folder.kind === 'output') {
      this.recordDetectedPrint(folder, filePath, result.fileId, result.isNew)
    }

    this.callbacks.onFilesChanged()
  }

  private recordDetectedPrint(
    folder: TrackedFolder,
    filePath: string,
    fileId: number,
    isNew: boolean
  ): void {
    // Dedupe on path + mtime so that chokidar's add/change pair, or a repeated
    // write of identical content, produces a single print event.
    let stamp = 'unknown'
    try {
      stamp = String(statSync(filePath).mtimeMs)
    } catch {
      /* file vanished between events */
    }

    const event = this.prints.record({
      fileId,
      source: 'watcher',
      documentName: basename(filePath),
      noteKey: isNew ? 'note.outputNewFile' : 'note.outputUpdatedFile',
      noteParams: { folder: folder.name },
      externalId: `watcher:${filePath}:${stamp}`
    })

    if (event) this.callbacks.onPrintRecorded(event)
  }
}
