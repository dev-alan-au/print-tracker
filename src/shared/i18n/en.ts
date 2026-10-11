/**
 * Canonical message catalogue. `en` defines the key set; every other locale must
 * satisfy `Catalog`, so a missing translation is a compile error.
 *
 * Placeholders use `{name}` and are substituted by `translate()`.
 */
export const en = {
  /* ------------------------------------------------------------------ app */
  'app.subtitle': 'Files & print history',

  'nav.overview': 'Overview',
  'nav.dashboard': 'Dashboard',
  'nav.folders': 'Folders',
  'nav.files': 'Files',
  'nav.history': 'Print history',
  'nav.settings': 'Settings',
  'nav.query': 'Query',

  'sidebar.spoolerMonitoring': 'Spooler monitoring',
  'sidebar.spoolerIdle': 'Spooler idle',
  'sidebar.windowsOnly': '(Windows only)',
  'sidebar.filesIndexed': '{count} files indexed',
  'sidebar.indexing': 'Indexing…',

  /* --------------------------------------------------------------- common */
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.refresh': 'Refresh',
  'common.delete': 'Delete',
  'common.open': 'Open',
  'common.locate': 'Locate',
  'common.remove': 'Remove',
  'common.rescan': 'Rescan',
  'common.copy': 'copy',
  'common.optional': 'Optional',
  'common.unknownDocument': 'Unknown document',
  'common.loading': 'Loading…',
  'common.emptyValue': '—',
  'common.refreshing': 'refreshing…',
  'common.never': 'never',

  /* ----------------------------------------------------------- page help */
  'help.summary': 'What is this page?',

  'help.overview':
    'Your home screen: two lists showing what you have printed and what you have not.\n\nOn the left are the files Print Tracker has seen being printed. On the right are the files it has not seen printed yet.\n\nNothing here changes your documents. The app only keeps notes about them.',

  'help.dashboard':
    'Numbers and graphs about everything Print Tracker has noticed so far.\n\nToday and this week follow the clock and calendar settings of your computer. If the totals look wrong, the Folders page is where you check whether a folder is still being watched.\n\nThe two buttons at the top jump straight to your folders or the full print log.',

  'help.folders':
    'These are the folders Print Tracker keeps an eye on. Add a folder once and the files inside it are listed for you.\n\nYour files are never copied, moved or changed. The app only remembers details about them, such as the name, the size and when they were last printed.\n\nA Library folder is simply listed. An Output folder also treats every new file that appears in it as something you printed, which suits printing that saves files into a folder. Rescan makes the app read a folder again.',

  'help.files':
    'Every file Print Tracker has found in the folders you added.\n\nType in the search box to find a file by its name or by the folder it sits in. The list can also be sorted and filtered.\n\nA missing label means the file is no longer where the app last saw it, usually because it was moved, renamed or deleted outside the app. You can open a file, show it in its folder, or record a print for it yourself.',

  'help.history':
    'A list of every print Print Tracker knows about, newest first.\n\nThe small tag on each row says how the print was noticed: a folder you asked the app to watch, the print log kept by Windows, or your own entry added by hand.\n\nDeleting a row only removes it from this list. It never touches the file itself.',

  'help.query':
    'A tool for advanced users. You type a question in a special language called SQL and the answer appears in a table.\n\nBy default it is allowed to look but not to touch, so it cannot change anything. Only turn read-only off if you know how SQL works, because changes made there are permanent.\n\nIf SQL means nothing to you, you never need this page.',

  'help.settings':
    'Everything you can change about how Print Tracker behaves.\n\nScreen appearance sets the language and the light or dark colours. Print tracking switches the Windows print log on and off, and only works on Windows. Backups are copies of everything the app has saved, taken automatically each time it starts, and you can make one yourself or go back to an older one.\n\nWatching decides how closely folders are checked for new files. The Danger zone erases everything the app has saved and starts afresh.',

  'source.watcher': 'Folder watch',
  'source.spooler': 'Spooler',
  'source.manual': 'Manual',
  'source.app': 'From the app',

  /* -------------------------------------------------------------- printing */
  'print.title': 'Print files',
  'print.intro':
    'Each file is handed to your operating system to print, using the same programs that normally print it. Printing only starts once the system accepts the job, so a file that is queued is recorded in the print history.',
  'print.printer': 'Printer',
  'print.defaultPrinter': 'System default',
  'print.printerUnknown': 'No printers were found, so the system default will be used.',
  'print.copies': 'Copies',
  'print.submit': 'Print',
  'print.submitting': 'Sending…',
  'print.selected.one': '{count} file ready to print',
  'print.selected.other': '{count} files ready to print',
  'print.result.ok': 'Sent to the printer',
  'print.result.failed': 'Not printed',
  'print.result.summary': '{ok} of {total} files were sent to the printer.',
  'print.unsupported.title': 'Printing is not available here',
  'print.unsupported.body':
    'Print Tracker has no way to send files to a printer on this computer. Print the file from its own application instead, then use Mark printed to record it.',

  'files.selected.one': '{count} selected',
  'files.selected.other': '{count} selected',
  'files.selectAll': 'Select every file on this page',
  'files.selectFile': 'Select {name}',
  'files.clearSelection': 'Clear selection',
  'files.printSelected': 'Print selected…',

  'print.error.unsupported': 'This computer cannot print from Print Tracker.',
  'print.error.unknown': 'This file is no longer in the index.',
  'print.error.missing': 'The file is no longer at its recorded location.',
  'print.error.noHandler': 'No program on this computer can print this type of file.',

  'print.toast.queued': '{count} file(s) sent to the printer.',
  'print.toast.partial': '{ok} of {total} were sent; the rest could not be printed.',
  'print.toast.none': 'Nothing was sent to the printer.',

  'unit.prints.one': '{count} print',
  'unit.prints.other': '{count} prints',

  /* ------------------------------------------------------------ dashboard */
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'A summary of your folders, files and prints.',
  'dashboard.manageFolders': 'Manage folders',
  'dashboard.printHistory': 'Print history',

  'dashboard.stat.folders': 'Folders',
  'dashboard.stat.files': 'Files indexed',
  'dashboard.stat.prints': 'Prints recorded',
  'dashboard.stat.today': 'Today',
  'dashboard.stat.week': 'This week',

  'dashboard.hint.watched': 'being watched',
  'dashboard.hint.present': 'currently present',
  'dashboard.hint.allTime': 'all time',
  'dashboard.hint.sinceMidnight': 'since midnight',
  'dashboard.hint.sinceMonday': 'since Monday',

  'dashboard.chart.title': 'Prints — last 14 days',
  'dashboard.chart.tooltip': '{day}: {count} prints',

  'dashboard.sources.title': 'By detection source',
  'dashboard.sources.watcher': 'Files appearing in output folders',
  'dashboard.sources.spooler': 'Windows print queue & event log',
  'dashboard.sources.manual': 'Logged by hand',
  'dashboard.sources.app': 'Printed from Print Tracker',

  'dashboard.top.title': 'Most printed',
  'dashboard.top.emptyTitle': 'No prints recorded yet',
  'dashboard.top.emptyBody': 'Add an output folder or mark a file as printed.',
  'dashboard.recent.title': 'Recent activity',
  'dashboard.recent.empty': 'Nothing printed yet.',
  'dashboard.loading': 'Loading dashboard…',

  /* -------------------------------------------------------------- overview */
  'overview.title': 'Overview',
  'overview.subtitle': 'Which files have been printed, and which have not.',
  'overview.printed.title': 'Printed',
  'overview.notPrinted.title': 'Not printed',
  'overview.printed.empty': 'Nothing has been printed yet.',
  'overview.notPrinted.empty': 'Every tracked file has been printed.',
  'overview.summary': '{printed} of {total} files printed',
  'overview.loading': 'Loading overview…',
  'overview.searchPlaceholder': 'Search files or folders…',
  'overview.filtered': 'Filtered by “{term}”',
  'overview.search.noMatch': 'No files match “{term}”.',

  /* -------------------------------------------------------------- folders */
  'folders.title': 'Folders',
  'folders.subtitle':
    'The folders Print Tracker keeps an eye on. Your files stay where they are.',
  'folders.rescanAll': 'Rescan all',
  'folders.add': '+ Add folder',

  'folders.table.folder': 'Folder',
  'folders.table.role': 'Role',
  'folders.table.subfolders': 'Subfolders',
  'folders.table.enabled': 'Enabled',
  'folders.table.files': 'Files',

  'folders.role.library': 'Library',
  'folders.role.output': 'Output / spool',
  'folders.role.libraryLong': 'Library — index files, no automatic print events',
  'folders.role.outputLong': 'Output / spool — new files count as prints',
  'folders.recursive': 'recursive',
  'folders.badge.output': 'output',

  'folders.loading': 'Loading folders…',
  'folders.emptyTitle': 'No folders tracked yet',
  'folders.emptyBody':
    'Add a folder of documents, or an output folder that your print workflow drops files into.',
  'folders.confirmRemove':
    'Stop tracking "{name}"?\n\nIts indexed files are removed from the database. Recorded print history is kept.',

  'folders.modal.title': 'Track a folder',
  'folders.modal.folder': 'Folder',
  'folders.modal.role': 'Role',
  'folders.modal.includeSubfolders': 'Include subfolders',
  'folders.modal.note':
    'Files are not copied. Print Tracker only stores the path, size and timestamps in a local database.',
  'folders.modal.submit': 'Add folder',
  'folders.modal.submitting': 'Indexing…',

  'folders.toast.rescanned': 'Rescanned "{name}" — {count} file(s).',
  'folders.toast.rescannedAll': 'Rescanned {folders} folder(s) — {files} file(s).',

  /* ---------------------------------------------------------------- files */
  'files.title': 'Files',
  'files.count.one': '{count} indexed file',
  'files.count.other': '{count} indexed files',
  'files.searchPlaceholder': 'Search file name, folder or path…',
  'files.allFolders': 'All folders',
  'files.sort.nameAsc': 'Name A→Z',
  'files.sort.nameDesc': 'Name Z→A',
  'files.sort.recent': 'Recently changed',
  'files.sort.prints': 'Most printed',
  'files.sort.lastPrinted': 'Last printed',
  'files.sort.size': 'Largest',
  'files.printedOnly': 'printed only',
  'files.loading': 'Loading files…',
  'files.emptyTitle': 'No files match',
  'files.emptyBody': 'Add a folder to track, or loosen the filters above.',

  'files.table.file': 'File',
  'files.table.folder': 'Folder',
  'files.table.size': 'Size',
  'files.table.modified': 'Modified',
  'files.table.prints': 'Prints',
  'files.table.lastPrinted': 'Last printed',

  'files.badge.missing': 'missing',
  'files.markPrinted': 'Mark printed',
  'files.confirmRemove':
    'Remove "{name}" from the index?\n\nThe file on disk is not touched. Recorded print history is kept.',
  'files.toast.removed': 'Removed "{name}" from the index.',

  /* -------------------------------------------------------------- history */
  'history.title': 'Print history',
  'history.count.one': '{count} print event',
  'history.count.other': '{count} print events',
  'history.logPrint': '+ Log a print',
  'history.searchPlaceholder': 'Search document, folder, printer or note…',
  'history.allSources': 'All sources',
  'history.loading': 'Loading history…',
  'history.emptyTitle': 'No print events',
  'history.emptyBody': 'Events appear here as folders or the print spooler report them.',

  'history.table.printed': 'Printed',
  'history.table.document': 'Document',
  'history.table.source': 'Source',
  'history.table.printer': 'Printer',
  'history.table.copies': 'Copies',
  'history.table.pages': 'Pages',
  'history.table.user': 'User',

  /* --------------------------------------------------------- manual entry */
  'manual.title': 'Log a print',
  'manual.document': 'Document',
  'manual.documentPlaceholder': 'e.g. invoice-2026-10.pdf',
  'manual.documentHint':
    'Matching an indexed file name links this print to that file automatically.',
  'manual.printer': 'Printer',
  'manual.copies': 'Copies',
  'manual.pages': 'Pages',
  'manual.printedAt': 'Printed at',
  'manual.note': 'Note',
  'manual.submit': 'Record print',
  'manual.saving': 'Saving…',
  'manual.toast.saved': 'Print event recorded.',
  'manual.error.document': 'Enter a document name, or pick one of the indexed files.',

  /* ---------------------------------------------------------------- query */
  'query.title': 'Query',
  'query.subtitle': 'For advanced users: ask the saved data direct questions.',
  'query.schema.title': 'Schema',
  'query.editor.placeholder': 'SELECT * FROM files LIMIT 50;',
  'query.run': 'Run',
  'query.readOnly': 'read-only',
  'query.readOnlyHint':
    'Statements run inside a transaction that is always rolled back, and only SELECT / WITH / EXPLAIN / PRAGMA are accepted.',
  'query.writeHint':
    'Write mode: changes are permanent. A snapshot was taken when the app started if you need to go back.',
  'query.result.rows': '{count} row(s)',
  'query.result.changes': '{count} row(s) affected',
  'query.result.executed': 'Statement executed.',
  'query.error.title': 'Statement failed',
  'query.error.readOnly':
    'Read-only mode only allows SELECT, WITH, EXPLAIN, PRAGMA and VALUES.',

  /* ------------------------------------------------------------- settings */
  'settings.title': 'Settings',
  'settings.subtitle': 'Preferences, backups and housekeeping.',

  'settings.appearance.title': 'Appearance',
  'settings.appearance.language': 'Display language',
  'settings.appearance.system': 'System default',
  'settings.appearance.theme': 'Theme',
  'settings.appearance.themeLight': 'Light',
  'settings.appearance.themeDark': 'Dark',

  'settings.spooler.title': 'Windows print spooler',
  'settings.spooler.running': 'running',
  'settings.spooler.stopped': 'stopped',
  'settings.spooler.start': 'Start monitoring',
  'settings.spooler.stop': 'Stop monitoring',
  'settings.spooler.pollNow': 'Poll now',
  'settings.spooler.listPrinters': 'List printers',
  'settings.spooler.pollInterval': 'Poll interval (seconds)',
  'settings.spooler.autoStart': 'start monitoring with the app',
  'settings.spooler.eventLog': 'Event log enabled',
  'settings.spooler.eventLogEnabled': 'yes — reading Microsoft-Windows-PrintService/Operational',
  'settings.spooler.eventLogDisabled': 'no — falling back to print-queue tracking',
  'settings.spooler.eventLogUnknown': 'unknown',
  'settings.spooler.lastPoll': 'Last poll',
  'settings.spooler.never': 'never',
  'settings.spooler.printers': 'Printers detected',
  'settings.spooler.unsupported':
    'Spooler monitoring only works on Windows. On this platform Print Tracker still tracks files inside watched folders and accepts manual print entries.',
  'settings.spooler.enableLog':
    'The operational print log is disabled, so completed jobs are inferred from the print queue. For exact page counts and document names, enable it once from an elevated PowerShell:',

  'settings.backups.title': 'Backups',
  'settings.backups.description':
    'A snapshot is written every time the app starts, and the ten most recent are kept.',
  'settings.backups.create': 'Back up now',
  'settings.backups.empty': 'No backups yet.',
  'settings.backups.created': 'Backup created.',
  'settings.backups.removed': 'Backup deleted.',
  'settings.backups.confirmRemove': 'Delete this backup?\n\n{name}',

  'settings.watching.title': 'Folder watching',
  'settings.watching.autoStart': 'watch folders while the app is running',
  'settings.watching.stability': 'Wait for writes to settle (ms)',
  'settings.watching.note':
    'A file in an output folder counts as a print once it has been stable for this long. Increase it if your print workflow writes files in several passes.',

  'settings.about.title': 'About',
  'settings.about.application': 'Application',
  'settings.about.platform': 'Platform',
  'settings.about.runtime': 'Electron / Node / Chromium',
  'settings.about.dataDir': 'Data directory',
  'settings.about.database': 'Database',
  'settings.about.sessionUptime': 'Session uptime',

  /* ------------------------------------------------------- settings: reset */
  'settings.reset.danger': 'Danger zone',
  'settings.reset.description':
    'Start over with an empty database. The tracked folders, indexed files and print history are all deleted. Files on disk are never touched.',
  'settings.reset.open': 'Reset application…',
  'settings.reset.title': 'Reset application data',
  'settings.reset.intro': 'This will permanently delete:',
  'settings.reset.folders': 'Tracked folders',
  'settings.reset.files': 'Indexed files',
  'settings.reset.prints': 'Print events',
  'settings.reset.backups': 'Saved backups',
  'settings.reset.warning':
    'This cannot be undone. Your documents are not deleted — only what Print Tracker has recorded about them.',
  'settings.reset.backupFirst': 'Save a backup first, so this can be undone',
  'settings.reset.removeBackups': 'Also delete the {count} existing backup(s)',
  'settings.reset.confirmWord': 'RESET',
  'settings.reset.confirmLabel': 'Type {word} to confirm',
  'settings.reset.confirm': 'Reset now',
  'settings.reset.working': 'Resetting…',

  /* ----------------------------------------------------- settings: restore */
  'settings.backups.restore': 'Restore',
  'settings.backups.restoreFromFile': 'Restore from file…',
  'settings.restore.title': 'Restore from a snapshot',
  'settings.restore.file': 'File',
  'settings.restore.size': 'Size',
  'settings.restore.modified': 'Last modified',
  'settings.restore.version': 'Database version',
  'settings.restore.versionValue': '{found} (this app reads {supported})',
  'settings.restore.checkFailed': 'The file could not be checked.',
  'settings.restore.okIntro': 'This snapshot passed every check and contains:',
  'settings.restore.blockedTitle': 'This file cannot be restored:',
  'settings.restore.undo':
    'Your current data is saved as a new snapshot first, so a restore can be undone.',
  'settings.restore.confirm': 'Restore now',
  'settings.restore.working': 'Restoring…',

  'settings.restore.problem.missing': 'The file no longer exists.',
  'settings.restore.problem.notAFile': 'This is a folder, not a file.',
  'settings.restore.problem.empty': 'The file is empty.',
  'settings.restore.problem.notADatabase': 'This is not a Print Tracker database.',
  'settings.restore.problem.corrupt': 'The database is damaged and failed its integrity check.',
  'settings.restore.problem.missingTables': 'Expected tables are missing: {items}',
  'settings.restore.problem.missingColumns': 'Expected columns are missing: {items}',
  'settings.restore.problem.newerSchema':
    'This snapshot was written by a newer version of the app (database {found}, this app reads {supported}). Update the app and try again.',
  'settings.restore.problem.foreignKeyViolations':
    'The database refers to rows that are not in it, so it is incomplete.',
  'settings.restore.problem.sameFile':
    'This is the database the app is currently using. Choose a snapshot instead.',
  'settings.toast.copied': 'Database path copied.',

  /* -------------------------------------------------------- system toasts */
  'toast.printRecorded': 'Print recorded — {name}',
  'toast.folderAdded': 'Tracking "{name}" — {count} file(s) indexed.',
  'toast.folderRemoved': 'Stopped tracking "{name}".',

  /* --------------------------- notes attached to system-recorded events */
  'note.outputNewFile': 'New file detected in output folder "{folder}"',
  'note.outputUpdatedFile': 'File updated in output folder "{folder}"',
  'note.spoolerEventLog': 'Reported by the Windows print spooler event log',
  'note.spoolerQueue': 'Print job left the Windows print queue (completed or cancelled)'
} as const
