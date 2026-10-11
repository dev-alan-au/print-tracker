import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AddFolderInput,
  AppInfo,
  AppSettings,
  BackupEntry,
  DashboardStats,
  FileQuery,
  FolderDirectory,
  ManualPrintInput,
  Page,
  PrintEvent,
  PrintMethod,
  PrintQuery,
  PrintReport,
  PrintRequestInput,
  PrinterInfo,
  PrintTrackerApi,
  QueryResult,
  ResetOptions,
  ResetPreview,
  ResetReport,
  RestoreInspection,
  RestoreReport,
  SchemaTable,
  Student,
  SpoolerStatus,
  ToastMessage,
  TrackedFile,
  TrackedFolder,
  UpdateFolderInput
} from '@shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: PrintTrackerApi = {
  folders: {
    list: () => ipcRenderer.invoke(IPC.folders.list) as Promise<TrackedFolder[]>,
    add: (input: AddFolderInput) =>
      ipcRenderer.invoke(IPC.folders.add, input) as Promise<TrackedFolder>,
    pickDirectory: () => ipcRenderer.invoke(IPC.folders.pickDirectory) as Promise<string | null>,
    update: (input: UpdateFolderInput) =>
      ipcRenderer.invoke(IPC.folders.update, input) as Promise<TrackedFolder>,
    remove: (id: number) => ipcRenderer.invoke(IPC.folders.remove, id) as Promise<void>,
    rescan: (id: number) =>
      ipcRenderer.invoke(IPC.folders.rescan, id) as Promise<{ indexed: number }>,
    reveal: (id: number) => ipcRenderer.invoke(IPC.folders.reveal, id) as Promise<void>
  },
  files: {
    list: (query: FileQuery) =>
      ipcRenderer.invoke(IPC.files.list, query) as Promise<Page<TrackedFile>>,
    open: (id: number) => ipcRenderer.invoke(IPC.files.open, id) as Promise<void>,
    reveal: (id: number) => ipcRenderer.invoke(IPC.files.reveal, id) as Promise<void>,
    remove: (id: number) => ipcRenderer.invoke(IPC.files.remove, id) as Promise<void>,
    markPrinted: (input: ManualPrintInput) =>
      ipcRenderer.invoke(IPC.files.markPrinted, input) as Promise<PrintEvent>,
    setNotes: (id: number, notes: string) =>
      ipcRenderer.invoke(IPC.files.setNotes, id, notes) as Promise<TrackedFile>,
    directories: (folderId?: number | null) =>
      ipcRenderer.invoke(IPC.files.directories, folderId ?? null) as Promise<FolderDirectory[]>,
    print: (input: PrintRequestInput) =>
      ipcRenderer.invoke(IPC.files.print, input) as Promise<PrintReport>,
    method: () => ipcRenderer.invoke(IPC.files.method) as Promise<PrintMethod>,
    listPrinters: () => ipcRenderer.invoke(IPC.files.listPrinters) as Promise<PrinterInfo[]>
  },
  prints: {
    list: (query: PrintQuery) =>
      ipcRenderer.invoke(IPC.prints.list, query) as Promise<Page<PrintEvent>>,
    addManual: (input: ManualPrintInput) =>
      ipcRenderer.invoke(IPC.prints.addManual, input) as Promise<PrintEvent>,
    remove: (id: number) => ipcRenderer.invoke(IPC.prints.remove, id) as Promise<void>,
    stats: () => ipcRenderer.invoke(IPC.prints.stats) as Promise<DashboardStats>
  },
  spooler: {
    status: () => ipcRenderer.invoke(IPC.spooler.status) as Promise<SpoolerStatus>,
    start: () => ipcRenderer.invoke(IPC.spooler.start) as Promise<SpoolerStatus>,
    stop: () => ipcRenderer.invoke(IPC.spooler.stop) as Promise<SpoolerStatus>,
    pollNow: () => ipcRenderer.invoke(IPC.spooler.pollNow) as Promise<SpoolerStatus>,
    listPrinters: () => ipcRenderer.invoke(IPC.spooler.listPrinters) as Promise<string[]>
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get) as Promise<AppSettings>,
    update: (patch: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC.settings.update, patch) as Promise<AppSettings>,
    appInfo: () => ipcRenderer.invoke(IPC.settings.appInfo) as Promise<AppInfo>
  },
  backups: {
    list: () => ipcRenderer.invoke(IPC.backups.list) as Promise<BackupEntry[]>,
    create: () => ipcRenderer.invoke(IPC.backups.create) as Promise<BackupEntry>,
    remove: (path: string) => ipcRenderer.invoke(IPC.backups.remove, path) as Promise<void>
  },
  query: {
    schema: () => ipcRenderer.invoke(IPC.query.schema) as Promise<SchemaTable[]>,
    run: (sql: string, readOnly: boolean) =>
      ipcRenderer.invoke(IPC.query.run, sql, readOnly) as Promise<QueryResult>
  },
  app: {
    previewReset: () => ipcRenderer.invoke(IPC.app.previewReset) as Promise<ResetPreview>,
    reset: (options: ResetOptions) =>
      ipcRenderer.invoke(IPC.app.reset, options) as Promise<ResetReport>,
    inspectBackup: (path: string) =>
      ipcRenderer.invoke(IPC.app.inspectBackup, path) as Promise<RestoreInspection>,
    restoreBackup: (path: string) =>
      ipcRenderer.invoke(IPC.app.restoreBackup, path) as Promise<RestoreReport>,
    pickBackupFile: () => ipcRenderer.invoke(IPC.app.pickBackupFile) as Promise<string | null>
  },
  students: {
    list: () => ipcRenderer.invoke(IPC.students.list) as Promise<Student[]>,
    add: (name: string) => ipcRenderer.invoke(IPC.students.add, name) as Promise<Student>,
    rename: (id: number, name: string) =>
      ipcRenderer.invoke(IPC.students.rename, id, name) as Promise<Student>,
    remove: (id: number) => ipcRenderer.invoke(IPC.students.remove, id) as Promise<void>,
    current: () => ipcRenderer.invoke(IPC.students.current) as Promise<number | null>,
    select: (id: number | null) =>
      ipcRenderer.invoke(IPC.students.select, id) as Promise<number | null>
  },
  events: {
    onFilesChanged: (callback: () => void) => subscribe<void>(IPC.events.filesChanged, callback),
    onPrintRecorded: (callback: (event: PrintEvent) => void) =>
      subscribe<PrintEvent>(IPC.events.printRecorded, callback),
    onSpoolerStatus: (callback: (status: SpoolerStatus) => void) =>
      subscribe<SpoolerStatus>(IPC.events.spoolerStatus, callback),
    onToast: (callback: (toast: ToastMessage) => void) =>
      subscribe<ToastMessage>(IPC.events.toast, callback)
  }
}

contextBridge.exposeInMainWorld('api', api)
