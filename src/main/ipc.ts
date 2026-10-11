import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AddFolderInput,
  AppInfo,
  AppSettings,
  FileQuery,
  ManualPrintInput,
  PrintQuery,
  UpdateFolderInput
} from '@shared/types'
import type { AppContext } from './app'

function asId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid id: ${String(value)}`)
  return id
}

function asObject<T>(value: unknown): T {
  if (!value || typeof value !== 'object') throw new Error('Invalid payload')
  return value as T
}

/** Opens a path and surfaces failures instead of a silent no-op. */
async function openPath(target: string): Promise<void> {
  const error = await shell.openPath(target)
  if (error) throw new Error(error)
}

export function registerIpc(ctx: AppContext, getWindow: () => BrowserWindow | null): void {
  /* ------------------------------------------------------------- folders */

  ipcMain.handle(IPC.folders.list, () => ctx.folders.list())

  ipcMain.handle(IPC.folders.pickDirectory, async () => {
    const window = getWindow()
    const result = window
      ? await dialog.showOpenDialog(window, {
          title: 'Choose a folder to track',
          properties: ['openDirectory', 'createDirectory'],
          buttonLabel: 'Track this folder'
        })
      : await dialog.showOpenDialog({
          title: 'Choose a folder to track',
          properties: ['openDirectory', 'createDirectory']
        })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.folders.add, (_event, input: unknown) => ctx.addFolder(asObject<AddFolderInput>(input)))

  ipcMain.handle(IPC.folders.update, (_event, input: unknown) =>
    ctx.updateFolder(asObject<UpdateFolderInput>(input))
  )

  ipcMain.handle(IPC.folders.remove, (_event, id: unknown) => {
    ctx.removeFolder(asId(id))
  })

  ipcMain.handle(IPC.folders.rescan, (_event, id: unknown) => {
    return { indexed: ctx.rescanFolder(asId(id)) }
  })

  ipcMain.handle(IPC.folders.reveal, async (_event, id: unknown) => {
    const folder = ctx.folders.get(asId(id))
    if (!folder) throw new Error('Folder not found.')
    await openPath(folder.path)
  })

  /* --------------------------------------------------------------- files */

  ipcMain.handle(IPC.files.list, (_event, query: unknown) => ctx.files.list(asObject<FileQuery>(query)))

  ipcMain.handle(IPC.files.open, async (_event, id: unknown) => {
    const file = ctx.files.get(asId(id))
    if (!file) throw new Error('File not found.')
    await openPath(file.path)
  })

  ipcMain.handle(IPC.files.reveal, (_event, id: unknown) => {
    const file = ctx.files.get(asId(id))
    if (!file) throw new Error('File not found.')
    shell.showItemInFolder(file.path)
  })

  ipcMain.handle(IPC.files.remove, (_event, id: unknown) => {
    ctx.files.remove(asId(id))
  })

  ipcMain.handle(IPC.files.markPrinted, (_event, input: unknown) =>
    ctx.prints.addManual(asObject<ManualPrintInput>(input))
  )

  /* -------------------------------------------------------------- prints */

  ipcMain.handle(IPC.prints.list, (_event, query: unknown) => ctx.prints.list(asObject<PrintQuery>(query)))

  ipcMain.handle(IPC.prints.addManual, (_event, input: unknown) =>
    ctx.prints.addManual(asObject<ManualPrintInput>(input))
  )

  ipcMain.handle(IPC.prints.remove, (_event, id: unknown) => {
    ctx.prints.remove(asId(id))
  })

  ipcMain.handle(IPC.prints.stats, () => ctx.prints.stats())

  /* ------------------------------------------------------------- spooler */

  ipcMain.handle(IPC.spooler.status, () => ctx.spooler.getStatus())

  ipcMain.handle(IPC.spooler.start, () => {
    const settings = ctx.settings.get()
    return ctx.spooler.start(settings.spoolerPollIntervalMs)
  })

  ipcMain.handle(IPC.spooler.stop, () => ctx.spooler.stop())

  ipcMain.handle(IPC.spooler.pollNow, () => ctx.spooler.poll())

  ipcMain.handle(IPC.spooler.listPrinters, () => ctx.spooler.listPrinters())

  /* ------------------------------------------------------------- backups */

  ipcMain.handle(IPC.backups.list, () => ctx.backups.list())

  ipcMain.handle(IPC.backups.create, () => ctx.backups.create('manual'))

  ipcMain.handle(IPC.backups.remove, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('A backup path is required.')
    ctx.backups.remove(path)
  })

  /* ------------------------------------------------------------ settings */

  ipcMain.handle(IPC.settings.get, () => ctx.settings.get())

  ipcMain.handle(IPC.settings.update, (_event, patch: unknown) => {
    const updated = ctx.settings.update(asObject<Partial<AppSettings>>(patch))

    // Apply the poll interval immediately while the spooler is running.
    if (ctx.spooler.getStatus().running) {
      ctx.spooler.start(updated.spoolerPollIntervalMs)
    }
    if (!updated.autoStartWatching) {
      ctx.stopWatching()
    } else if (ctx.watcher.watchingCount === 0) {
      ctx.startWatching()
    }

    return updated
  })

  ipcMain.handle(IPC.settings.appInfo, (): AppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron ?? 'unknown',
      node: process.versions.node ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      platform: process.platform,
      dataDir: app.getPath('userData'),
      databasePath: ctx.databasePath,
      backupsDir: ctx.backups.directory
    }
  })
}
