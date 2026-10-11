import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AddFolderInput,
  AppInfo,
  AppSettings,
  BackupEntry,
  DashboardStats,
  FileQuery,
  ManualPrintInput,
  Page,
  PrintEvent,
  PrintQuery,
  PrintTrackerApi,
  QueryResult,
  ResetOptions,
  ResetPreview,
  ResetReport,
  SchemaTable,
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
      ipcRenderer.invoke(IPC.files.markPrinted, input) as Promise<PrintEvent>
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
      ipcRenderer.invoke(IPC.app.reset, options) as Promise<ResetReport>
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
