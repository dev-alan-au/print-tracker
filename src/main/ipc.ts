import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AddFolderInput,
  AppInfo,
  AppSettings,
  FileQuery,
  ManualPrintInput,
  PrintQuery,
  PrintRequestInput,
  ResetOptions,
  UpdateFolderInput
} from '@shared/types'
import type { AppContext } from './app'

/** Upper bound on one print request, so a stray payload cannot queue thousands. */
const MAX_PRINT_BATCH = 200

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

  ipcMain.handle(IPC.files.setNotes, (_event, id: unknown, notes: unknown) => {
    if (typeof notes !== 'string') throw new Error('A note is required.')
    return ctx.files.setNotes(asId(id), notes)
  })

  ipcMain.handle(IPC.files.directories, (_event, folderId: unknown) => {
    // Null rather than a missing argument means "every folder".
    if (folderId === null || folderId === undefined) return ctx.files.directories()
    return ctx.files.directories(asId(folderId))
  })

  ipcMain.handle(IPC.files.markPrinted, (_event, input: unknown) =>
    ctx.prints.addManual(asObject<ManualPrintInput>(input))
  )

  ipcMain.handle(IPC.files.method, () => ctx.printer.method())

  ipcMain.handle(IPC.files.listPrinters, () => ctx.printer.listPrinters())

  ipcMain.handle(IPC.files.print, async (_event, input: unknown) => {
    const payload = asObject<PrintRequestInput>(input)
    const fileIds = Array.isArray(payload.fileIds)
      ? payload.fileIds.map((id) => asId(id)).slice(0, MAX_PRINT_BATCH)
      : []
    if (fileIds.length === 0) throw new Error('Select at least one file to print.')

    const report = await ctx.printFiles({
      fileIds,
      printer: typeof payload.printer === 'string' ? payload.printer : null,
      copies: Number(payload.copies ?? 1)
    })

    return report
  })

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

  /* --------------------------------------------------------------- query */

  ipcMain.handle(IPC.query.schema, () => ctx.query.schema())

  ipcMain.handle(IPC.query.run, (_event, sql: unknown, readOnly: unknown) => {
    if (typeof sql !== 'string') throw new Error('A SQL statement is required.')
    return ctx.query.run(sql, readOnly === true)
  })

  /* ----------------------------------------------------------- reset app */

  ipcMain.handle(IPC.app.previewReset, () => ctx.reset.preview())

  ipcMain.handle(IPC.app.reset, (_event, options: unknown) => {
    const payload = asObject<ResetOptions>(options)
    const report = ctx.resetApp({
      backupFirst: payload.backupFirst === true,
      removeBackups: payload.removeBackups === true
    })

    // The database no longer holds any snapshot history, so anything the
    // renderer cached about it is stale - reload rather than patch each panel.
    // Deferred so this reply is delivered first.
    setTimeout(() => {
      const window = getWindow()
      if (window && !window.isDestroyed()) window.webContents.reload()
    }, 400)

    return report
  })

  /* --------------------------------------------------------- restore app */

  ipcMain.handle(IPC.app.inspectBackup, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('A file path is required.')
    return ctx.restore.inspect(path)
  })

  ipcMain.handle(IPC.app.pickBackupFile, async () => {
    const window = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a database snapshot',
      buttonLabel: 'Check this file',
      properties: ['openFile'],
      filters: [
        { name: 'Print Tracker snapshots', extensions: ['db'] },
        { name: 'All files', extensions: ['*'] }
      ],
      defaultPath: ctx.backups.directory
    }

    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.app.restoreBackup, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('A file path is required.')
    const report = ctx.restoreBackup(path)

    // Every panel holds counts that are now wrong. Deferred so this reply is
    // delivered before the window goes away.
    setTimeout(() => {
      const window = getWindow()
      if (window && !window.isDestroyed()) window.webContents.reload()
    }, 400)

    return report
  })

  /* ------------------------------------------------------------ students */

  ipcMain.handle(IPC.students.list, () => ctx.students.list())

  ipcMain.handle(IPC.students.add, (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('A student name is required.')
    return ctx.students.add(name)
  })

  ipcMain.handle(IPC.students.rename, (_event, id: unknown, name: unknown) => {
    if (typeof name !== 'string') throw new Error('A student name is required.')
    return ctx.students.rename(asId(id), name)
  })

  ipcMain.handle(IPC.students.remove, (_event, id: unknown) => {
    const studentId = asId(id)
    ctx.students.remove(studentId)
    // Removing whoever is selected must not leave the app attributing prints to
    // a student that no longer exists.
    if (ctx.currentStudent() === studentId) ctx.selectStudent(null)
  })

  ipcMain.handle(IPC.students.current, () => ctx.currentStudent())

  ipcMain.handle(IPC.students.select, (_event, id: unknown) =>
    ctx.selectStudent(id === null || id === undefined ? null : asId(id))
  )

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
