/**
 * Types shared between the Electron main process, the preload bridge and the
 * React renderer. Keep this file free of any Node.js or DOM specific imports.
 */

import type { AppLanguage, MessageKey, MessageParams, NoteKey } from './i18n/types'

export type { AppLanguage, Locale, NoteKey, MessageKey, MessageParams } from './i18n/types'

/** UI colour scheme. Light is the default. */
export type AppTheme = 'light' | 'dark'

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

/* ---------------------------------------------------------------- folders */

/**
 * A directory that actually holds indexed files, derived from the file rows
 * rather than by walking the disk - so the filter can never offer a folder that
 * turns out to be empty, and it costs nothing to refresh.
 */
export interface FolderDirectory {
  folderId: number
  /** Absolute path, which is what a file query filters on. */
  path: string
  /** Path relative to the watched folder, for display. */
  label: string
  fileCount: number
}

/* --------------------------------------------------------------- students */

/** Someone using the app. Only a name is required - the point is to attribute
 *  prints to a person, not to keep a record about them. */
export interface Student {
  id: number
  name: string
  createdAt: string
  /** Print events currently attributed to this student. */
  printCount: number
}

/* -------------------------------------------------------------------- files */

export interface TrackedFile {
  id: number
  folderId: number
  folderName: string | null
  path: string
  /**
   * Path relative to the watched folder, e.g. `reports/q3.pdf`. Absolute paths
   * are long enough to bury the part that identifies the file, so this is what
   * the list shows and the absolute path lives in the tooltip.
   */
  relativePath: string
  name: string
  ext: string | null
  size: number
  mtime: string | null
  present: boolean
  firstSeenAt: string
  lastSeenAt: string
  printedCount: number
  lastPrintedAt: string | null
  /**
   * Short free-text note about the file itself, or null. Capped at
   * `FILE_NOTES_MAX_LENGTH` characters.
   */
  notes: string | null
}

export interface FileQuery {
  folderId?: number | null
  /**
   * When set, the print counts on each row describe this student only, so
   * "printed" means "printed by them" rather than by anyone.
   */
  studentId?: number | null
  /**
   * Restrict to files inside this directory and everything below it. Absolute,
   * as stored on the file rows. Ignored when empty.
   */
  directory?: string
  search?: string
  /** Restrict to files that have, or have never, been printed. */
  printed?: 'printed' | 'unprinted'
  sort?: 'name' | 'recent' | 'prints' | 'size' | 'lastPrinted'
  direction?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** Longest note a file may carry. Enforced in the main process, not only in the
 *  input, so a crafted IPC call cannot store something longer. */
export const FILE_NOTES_MAX_LENGTH = 255

/* ---------------------------------------------------------------- students */

/** Longest student name accepted. Shared because the main process enforces it
 *  and the input needs the same limit, and a name that the field accepts but
 *  the service rejects is a bug waiting to happen. */
export const STUDENT_NAME_MAX_LENGTH = 80

/* ---------------------------------------------------------------- printing */

/** How a print job was handed to the operating system. */
export type PrintMethod =
  /** Windows: ShellExecute through the registered "print"/"printto" verb. */
  | 'windows'
  /** macOS and Linux: the CUPS `lp` command. */
  | 'cups'
  /** Neither is available, so the app cannot print. */
  | 'unsupported'

export interface PrinterInfo {
  name: string
  /** The printer the operating system would use by default. */
  isDefault: boolean
}

export interface PrintRequestInput {
  fileIds: number[]
  /** Printer name, or null/omitted for the system default. */
  printer?: string | null
  copies?: number
}

/** Per-file outcome, so a batch can report partial success. */
export interface PrintFileResult {
  fileId: number
  name: string
  ok: boolean
  /** Translatable reason, when the failure is one we can describe. */
  errorKey?: MessageKey
  /** Raw message from the operating system; not translatable. */
  error?: string
}

export interface PrintReport {
  method: PrintMethod
  /** The printer used, when the system reports one. */
  printer: string | null
  results: PrintFileResult[]
}

/* ------------------------------------------------------------- print events */

/** How a print event was captured. `app` means the print was started from
 *  inside Print Tracker, rather than observed after the fact. */
export type PrintSource = 'watcher' | 'spooler' | 'manual' | 'app'

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
  /**
   * Free-text note. Only ever user-authored (manual entries); notes the app
   * generates itself are stored as `noteKey` instead.
   */
  note: string | null
  /** Localisation key for an app-generated note, or null. */
  noteKey: NoteKey | null
  /** Placeholder values for `noteKey`. */
  noteParams: MessageParams | null
  /** The student this print belongs to, or null when nothing was selected. */
  studentId: number | null
  /**
   * The student's name at the time of printing. Denormalised so history still
   * says who printed something after the student has been removed.
   */
  studentName: string | null
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
  /** Restrict to prints attributed to this student. */
  studentId?: number | null
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
  /** Free-text note; used for user-authored text only. */
  note?: string | null
  /** Preferred for app-generated notes so they stay translatable. */
  noteKey?: NoteKey | null
  noteParams?: MessageParams | null
  /** Who this print is for. Defaults to whoever is currently using the app. */
  studentId?: number | null
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

/* ----------------------------------------------------------------- backups */

export interface BackupEntry {
  name: string
  path: string
  size: number
  createdAt: string
}

/* ------------------------------------------------------------------ query */
export interface QueryColumn {
  name: string
  type: string
  notNull: boolean
  primaryKey: boolean
}

export interface SchemaTable {
  name: string
  columns: QueryColumn[]
}

export interface QueryResult {
  columns: string[]
  /** Cells are pre-normalised to values React can render directly. */
  rows: Record<string, string | number | null>[]
  /** Rows affected, or null when the statement does not report it. */
  changes: number | null
  /** True when the statement ran in read-only mode and was rolled back. */
  rolledBack: boolean
}

/* ------------------------------------------------------------------ reset */

/** Row counts a reset would destroy, shown to the user before they commit. */
export interface ResetCounts {
  folders: number
  files: number
  prints: number
}

export interface ResetPreview {
  counts: ResetCounts
  /** Snapshots already on disk, which may also be deleted. */
  backups: number
  databasePath: string
  backupsDir: string
}

export interface ResetOptions {
  /** Snapshot the current data before wiping it, so the reset is reversible. */
  backupFirst: boolean
  /** Also delete the snapshots that already exist on disk. */
  removeBackups: boolean
}

export interface ResetReport {
  removed: ResetCounts
  /** The safety-net snapshot, when one was requested. */
  backup: BackupEntry | null
  backupsRemoved: number
}

/* ---------------------------------------------------------------- restore */

/**
 * Why a candidate file cannot be restored. Reported as codes so the renderer
 * explains each one in the user's language.
 */
export type RestoreProblem =
  | 'missing'
  | 'notAFile'
  | 'empty'
  | 'notADatabase'
  | 'corrupt'
  | 'missingTables'
  | 'missingColumns'
  | 'newerSchema'
  | 'foreignKeyViolations'
  | 'sameFile'

export interface RestoreInspection {
  path: string
  /** True only when every check passed. */
  ok: boolean
  problems: RestoreProblem[]
  missingTables: string[]
  /** Dotted `table.column` names the candidate does not provide. */
  missingColumns: string[]
  counts: ResetCounts
  /** Schema version recorded inside the candidate. */
  schemaVersion: number
  /** Schema version this build understands. */
  supportedVersion: number
  sizeBytes: number
  modifiedAt: string | null
}

export interface RestoreReport {
  restored: ResetCounts
  /** Snapshot of the data that was replaced, so a restore can be undone. */
  backup: BackupEntry
  schemaVersion: number
}

/* ---------------------------------------------------------------- settings */

export interface AppSettings {
  spoolerEnabled: boolean
  spoolerPollIntervalMs: number
  autoStartWatching: boolean
  minFileStabilityMs: number
  /** UI language; `system` follows the operating system locale. */
  language: AppLanguage
  /** UI colour scheme. */
  theme: AppTheme
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
  backupsDir: string
}

/* ------------------------------------------------------------------- misc */

export interface Page<T> {
  items: T[]
  total: number
}

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface ToastMessage {
  kind: ToastKind
  /**
   * Preferred: a message key the renderer localises at display time. Main
   * process toasts use this so no English text is baked into the backend.
   */
  messageKey?: MessageKey
  messageParams?: MessageParams
  /**
   * Fallback text that is displayed verbatim. Used for technical failures
   * (e.g. a permission error) which are not translatable messages.
   */
  message?: string
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
    setNotes(id: number, notes: string): Promise<TrackedFile>
    directories(folderId?: number | null): Promise<FolderDirectory[]>
    print(input: PrintRequestInput): Promise<PrintReport>
    method(): Promise<PrintMethod>
    listPrinters(): Promise<PrinterInfo[]>
  }
  prints: {
    list(query: PrintQuery): Promise<Page<PrintEvent>>
    addManual(input: ManualPrintInput): Promise<PrintEvent>
    remove(id: number): Promise<void>
    /**
     * Dashboard figures. The print counts describe the student passed in;
     * omitting it counts everybody, which only the tests want.
     */
    stats(studentId?: number | null): Promise<DashboardStats>
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
  backups: {
    list(): Promise<BackupEntry[]>
    create(): Promise<BackupEntry>
    remove(path: string): Promise<void>
  }
  query: {
    schema(): Promise<SchemaTable[]>
    run(sql: string, readOnly: boolean): Promise<QueryResult>
  }
  app: {
    previewReset(): Promise<ResetPreview>
    reset(options: ResetOptions): Promise<ResetReport>
    inspectBackup(path: string): Promise<RestoreInspection>
    restoreBackup(path: string): Promise<RestoreReport>
    pickBackupFile(): Promise<string | null>
  }
  students: {
    list(): Promise<Student[]>
    add(name: string): Promise<Student>
    rename(id: number, name: string): Promise<Student>
    remove(id: number): Promise<void>
    /**
     * Who is using the app right now. Held in the main process so that prints
     * detected by the watcher or the spooler are attributed to them too.
     */
    current(): Promise<number | null>
    select(id: number | null): Promise<number | null>
  }
  events: {
    onFilesChanged(cb: () => void): () => void
    onPrintRecorded(cb: (event: PrintEvent) => void): () => void
    onSpoolerStatus(cb: (status: SpoolerStatus) => void): () => void
    onToast(cb: (toast: ToastMessage) => void): () => void
  }
}
