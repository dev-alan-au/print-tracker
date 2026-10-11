/**
 * Types shared between the Electron main process, the preload bridge and the
 * React renderer. Keep this file free of any Node.js or DOM specific imports.
 */

/* ------------------------------------------------------------------ folders */

/** `library` folders are indexed. `output` folders additionally record a print
 *  event whenever a new file appears inside them (print-to-folder workflows). */
export type FolderKind = 'library' | 'output'

export interface TrackedFolder {
  id: number
  path: string
  name: string
  kind: FolderKind
  recursive: boolean
  enabled: boolean
  createdAt: string
  /** Number of indexed files currently in this folder. */
  fileCount: number
}

export interface AddFolderInput {
  path: string
  kind?: FolderKind
  recursive?: boolean
}

export interface UpdateFolderInput {
  id: number
  kind?: FolderKind
  recursive?: boolean
  enabled?: boolean
}

/* -------------------------------------------------------------------- files */

export interface TrackedFile {
  id: number
  folderId: number
  folderName: string | null
  path: string
  name: string
  ext: string | null
  size: number
  mtime: string | null
  present: boolean
  firstSeenAt: string
  lastSeenAt: string
  printedCount: number
  lastPrintedAt: string | null
}

export interface FileQuery {
  folderId?: number | null
  search?: string
  onlyPrinted?: boolean
  sort?: 'name' | 'recent' | 'prints' | 'size'
  direction?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/* ------------------------------------------------------------ print events */

/** How a print event was captured. */
export type PrintSource = 'watcher' | 'spooler' | 'manual'

export interface PrintEvent {
  id: number
  fileId: number | null
  /** Denormalised so history survives the file being deleted/moved. */
  fileName: string | null
  filePath: string | null
  source: PrintSource
  printer: string | null
  documentName: string | null
  copies: number
  pages: number | null
  userName: string | null
  status: string | null
  note: string | null
  printedAt: string
  createdAt: string
}

export interface ManualPrintInput {
  fileId?: number | null
  /** Used when the printed document is not part of the index. */
  documentName?: string | null
  printer?: string | null
  copies?: number
  pages?: number | null
  note?: string | null
  printedAt?: string | null
}

export interface PrintQuery {
  source?: PrintSource | null
  fileId?: number | null
  search?: string
  from?: string | null
  to?: string | null
  limit?: number
  offset?: number
}

/** Shape used internally by the watcher/spooler when recording an event. */
export interface RecordPrintInput {
  fileId?: number | null
  fileName?: string | null
  filePath?: string | null
  source: PrintSource
  printer?: string | null
  documentName?: string | null
  copies?: number
  pages?: number | null
  userName?: string | null
  status?: string | null
  note?: string | null
  printedAt?: string | null
  /** Dedupe key, e.g. `spooler:<recordId>`. */
  externalId?: string | null
}

/* ------------------------------------------------------------------- stats */

export interface DashboardStats {
  folderCount: number
  fileCount: number
  printCount: number
  printsToday: number
  printsThisWeek: number
  printsByDay: { day: string; count: number }[]
  printsBySource: { source: PrintSource; count: number }[]
  topFiles: { fileId: number | null; name: string; count: number }[]
  recent: PrintEvent[]
}

/* ----------------------------------------------------------------- spooler */

export interface SpoolerStatus {
  /** False on non-Windows platforms. */
  supported: boolean
  running: boolean
  /** Whether the PrintService operational event log is enabled. */
  logEnabled: boolean | null
  pollIntervalMs: number
  printers: string[]
  lastPollAt: string | null
  lastError: string | null
  lastErrorAt: string | null
}

/* ---------------------------------------------------------------- settings */

export interface AppSettings {
  spoolerEnabled: boolean
  spoolerPollIntervalMs: number
  autoStartWatching: boolean
  minFileStabilityMs: number
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  node: string
  chrome: string
  platform: string
  dataDir: string
  databasePath: string
}

/* ------------------------------------------------------------------- misc */

export interface Page<T> {
  items: T[]
  total: number
}

export interface ToastMessage {
  kind: 'info' | 'success' | 'warning' | 'error'
  message: string
}

/** The surface exposed on `window.api` by the preload script. */
export interface PrintTrackerApi {
  folders: {
    list(): Promise<TrackedFolder[]>
    add(input: AddFolderInput): Promise<TrackedFolder>
    pickDirectory(): Promise<string | null>
    update(input: UpdateFolderInput): Promise<TrackedFolder>
    remove(id: number): Promise<void>
    rescan(id: number): Promise<{ indexed: number }>
    reveal(id: number): Promise<void>
  }
  files: {
    list(query: FileQuery): Promise<Page<TrackedFile>>
    open(id: number): Promise<void>
    reveal(id: number): Promise<void>
    remove(id: number): Promise<void>
    markPrinted(input: ManualPrintInput): Promise<PrintEvent>
  }
  prints: {
    list(query: PrintQuery): Promise<Page<PrintEvent>>
    addManual(input: ManualPrintInput): Promise<PrintEvent>
    remove(id: number): Promise<void>
    stats(): Promise<DashboardStats>
  }
  spooler: {
    status(): Promise<SpoolerStatus>
    start(): Promise<SpoolerStatus>
    stop(): Promise<SpoolerStatus>
    pollNow(): Promise<SpoolerStatus>
    listPrinters(): Promise<string[]>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    appInfo(): Promise<AppInfo>
  }
  events: {
    onFilesChanged(cb: () => void): () => void
    onPrintRecorded(cb: (event: PrintEvent) => void): () => void
    onSpoolerStatus(cb: (status: SpoolerStatus) => void): () => void
    onToast(cb: (toast: ToastMessage) => void): () => void
  }
}
