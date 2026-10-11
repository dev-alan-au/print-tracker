/** Canonical IPC channel names. Imported by main, preload and (for reference)
 *  the renderer so the two sides can never drift apart. */
export const IPC = {
  folders: {
    list: 'folders:list',
    add: 'folders:add',
    pickDirectory: 'folders:pick-directory',
    update: 'folders:update',
    remove: 'folders:remove',
    rescan: 'folders:rescan',
    reveal: 'folders:reveal'
  },
  files: {
    list: 'files:list',
    open: 'files:open',
    reveal: 'files:reveal',
    remove: 'files:remove',
    markPrinted: 'files:mark-printed',
    setNotes: 'files:set-notes',
    directories: 'files:directories',
    print: 'files:print',
    method: 'files:print-method',
    listPrinters: 'files:list-printers'
  },
  prints: {
    list: 'prints:list',
    addManual: 'prints:add-manual',
    remove: 'prints:remove',
    stats: 'prints:stats'
  },
  spooler: {
    status: 'spooler:status',
    start: 'spooler:start',
    stop: 'spooler:stop',
    pollNow: 'spooler:poll-now',
    listPrinters: 'spooler:list-printers'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    appInfo: 'settings:app-info'
  },
  backups: {
    list: 'backups:list',
    create: 'backups:create',
    remove: 'backups:remove'
  },
  query: {
    schema: 'query:schema',
    run: 'query:run'
  },
  app: {
    previewReset: 'app:preview-reset',
    reset: 'app:reset',
    inspectBackup: 'app:inspect-backup',
    restoreBackup: 'app:restore-backup',
    pickBackupFile: 'app:pick-backup-file'
  },
  students: {
    list: 'students:list',
    add: 'students:add',
    rename: 'students:rename',
    remove: 'students:remove',
    current: 'students:current',
    select: 'students:select'
  },
  events: {
    filesChanged: 'event:files-changed',
    printRecorded: 'event:print-recorded',
    spoolerStatus: 'event:spooler-status',
    toast: 'event:toast'
  }
} as const
