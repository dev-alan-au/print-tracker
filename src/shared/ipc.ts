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
    markPrinted: 'files:mark-printed'
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
  events: {
    filesChanged: 'event:files-changed',
    printRecorded: 'event:print-recorded',
    spoolerStatus: 'event:spooler-status',
    toast: 'event:toast'
  }
} as const
