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

  'source.watcher': 'Folder watch',
  'source.spooler': 'Spooler',
  'source.manual': 'Manual',

  'unit.prints.one': '{count} print',
  'unit.prints.other': '{count} prints',

  /* ------------------------------------------------------------ dashboard */
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Everything Print Tracker has indexed and printed so far.',
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
    'Library folders are indexed and tracked. Output folders also record a print every time a new file lands in them.',
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
  'query.subtitle': 'Run SQL against the local database.',
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
  'settings.subtitle': 'Detection sources, polling behaviour and application information.',

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
