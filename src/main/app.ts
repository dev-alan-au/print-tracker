import { dirname, join } from 'node:path'
import type {
  AddFolderInput,
  PrintEvent,
  SpoolerStatus,
  ToastMessage,
  TrackedFolder,
  UpdateFolderInput
} from '@shared/types'
import { Db } from './db/database'
import { BackupService } from './services/backups'
import { FileService } from './services/files'
import { FolderService } from './services/folders'
import { PrintService } from './services/prints'
import { QueryService } from './services/query'
import { SettingsService } from './services/settings'
import { SpoolerService } from './services/spooler'
import { WatcherService } from './services/watcher'

export interface AppEvents {
  filesChanged(): void
  printRecorded(event: PrintEvent): void
  spoolerStatus(status: SpoolerStatus): void
  toast(toast: ToastMessage): void
}

export interface AppContext {
  readonly db: Db
  readonly folders: FolderService
  readonly files: FileService
  readonly prints: PrintService
  readonly settings: SettingsService
  readonly watcher: WatcherService
  readonly spooler: SpoolerService
  readonly backups: BackupService
  readonly query: QueryService
  readonly databasePath: string

  addFolder(input: AddFolderInput): TrackedFolder
  updateFolder(input: UpdateFolderInput): TrackedFolder
  removeFolder(id: number): void
  rescanFolder(id: number): number
  rescanAll(): number
  startWatching(): void
  stopWatching(): void
  dispose(): void
}

export function createApp(databasePath: string, events: AppEvents): AppContext {
  const db = new Db(databasePath)
  const folders = new FolderService(db)
  const files = new FileService(db)
  const prints = new PrintService(db)
  const settings = new SettingsService(db)

  // Snapshots live beside the database so the two travel together.
  const backups = new BackupService(db, join(dirname(databasePath), 'backups'))
  const query = new QueryService(db)

  const watcher = new WatcherService(
    folders,
    files,
    prints,
    () => settings.get(),
    {
      onFilesChanged: events.filesChanged,
      onPrintRecorded: events.printRecorded
    }
  )

  const spooler = new SpoolerService(files, prints, {
    onStatus: events.spoolerStatus,
    onPrintRecorded: events.printRecorded
  })

  const rescanFolder = (id: number): number => {
    const folder = folders.get(id)
    if (!folder) throw new Error(`Unknown folder id: ${id}`)
    return files.scanFolder(folder)
  }

  const rescanAll = (): number => {
    let total = 0
    for (const folder of folders.list()) {
      total += files.scanFolder(folder)
    }
    return total
  }

  const addFolder = (input: AddFolderInput): TrackedFolder => {
    const folder = folders.add(input)
    const indexed = files.scanFolder(folder)
    watcher.refresh()
    events.toast({
      kind: 'success',
      messageKey: 'toast.folderAdded',
      messageParams: { name: folder.name, count: indexed }
    })
    events.filesChanged()
    return folder
  }

  const updateFolder = (input: UpdateFolderInput): TrackedFolder => {
    const folder = folders.update(input)
    watcher.refresh()
    events.filesChanged()
    return folder
  }

  const removeFolder = (id: number): void => {
    const folder = folders.get(id)
    folders.remove(id)
    watcher.refresh()
    events.toast({
      kind: 'info',
      messageKey: 'toast.folderRemoved',
      messageParams: { name: folder?.name ?? String(id) }
    })
    events.filesChanged()
  }

  const startWatching = (): void => {
    watcher.start()
    events.filesChanged()
  }

  const stopWatching = (): void => {
    watcher.stop()
  }

  return {
    db,
    folders,
    files,
    prints,
    settings,
    watcher,
    spooler,
    backups,
    query,
    databasePath,
    addFolder,
    updateFolder,
    removeFolder,
    rescanFolder,
    rescanAll,
    startWatching,
    stopWatching,
    dispose(): void {
      watcher.stop()
      spooler.stop()
      db.close()
    }
  }
}
