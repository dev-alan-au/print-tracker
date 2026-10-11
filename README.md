# Print Tracker

A Windows desktop application that keeps an index of files inside folders you
choose, and records **when those files are printed**.

It does not copy or move your files. It stores paths, sizes, timestamps and a
print history in a local SQLite database.

```
┌────────────┐   chokidar    ┌──────────────┐
│  folders   │──────────────▶│  files index │
└────────────┘               └──────┬───────┘
                                    │
┌────────────────────────┐          ▼
│ Windows print spooler  │──▶ ┌────────────────┐ ──▶ React UI
│ (event log + queue)    │    │ print_events   │
└────────────────────────┘    └────────────────┘
                                    ▲
                            manual "Mark printed"
```

## Three ways a print gets recorded

| Source           | How it works                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Folder watch** | Folders can be marked as **output / spool**. A file that appears there after startup counts as a print. Ideal for "print to folder" workflows. |
| **Spooler**      | On Windows, Print Tracker reads the `Microsoft-Windows-PrintService/Operational` event log (event id 307) and polls the live print queue.      |
| **Manual**       | A "Mark printed" / "Log a print" button for anything the app cannot observe.                                                                   |

Extra details are captured where available: printer, user, copies, pages and a
free-text note.

### Folder roles

- **Library** — indexed and searchable, no automatic print events.
- **Output / spool** — indexed **and** every new file is recorded as a print.

A file in an output folder is only counted once it has stopped changing for
`minFileStabilityMs` (default 1.5 s), so multi-pass writes do not produce
duplicate prints.

## Requirements

- Node.js **20.19+ or 22.12+** (developed on Node 22)
- To *run* the app: any OS Electron supports (handy for developing on Linux)
- To record spooler events: **Windows**. On other platforms that source is
  disabled and reported as "Windows only"

### No native modules

The database is [`node-sqlite3-wasm`](https://www.npmjs.com/package/node-sqlite3-wasm)
— a WebAssembly build of SQLite with a VFS that writes straight to a real file.
There is nothing to compile or `electron-rebuild`, which is what makes building
a Windows package from Linux practical.

## Getting started

```bash
npm install
npm run dev          # Vite dev server + Electron with HMR
```

Other scripts:

```bash
npm run typecheck    # tsc for main/preload and for the renderer
npm run build        # typecheck + bundle into out/
npm run test:db      # SQLite smoke test against the real schema
npm run build:win    # Windows NSIS installer into release/
npm run build:dir    # unpacked build, no installer
```

## Windows print spooler setup

By default the operational print log is **disabled**, so Print Tracker falls back
to watching the print queue: a job that leaves the queue is recorded as printed.
That gives you document name, printer, user and timing, but not always exact page
counts, and a cancelled job is indistinguishable from a completed one.

For accurate results, enable the log once from an **elevated PowerShell**:

```powershell
wevtutil sl Microsoft-Windows-PrintService/Operational /e:true
```

Print Tracker detects whether the log is enabled and tells you in
**Settings → Windows print spooler**. Reading the log needs no elevation.

> Implementation note: the event log XML is parsed defensively because the
> `EventData` field names vary between Windows versions — several spellings
> (`DocumentName`, `Document`, `JobName`, …) are tried for each field.

## Building for Windows

Run `npm run build:win` on Windows for the smoothest result. Building from Linux
works but electron-builder needs **Wine** to stamp the executable's version
information; install it or build in CI.

The output lands in `release/` as an NSIS installer, configured in
`electron-builder.yml` (per-user install, changeable install directory, desktop
shortcut).

Because the SQLite driver is pure WebAssembly, the same `node_modules` produce a
correct Windows build without any cross-compilation of native code.

## Where your data lives

`app.getPath('userData')`, which resolves to:

- Windows: `%APPDATA%\print-tracker\print-tracker.db`
- Linux (dev): `~/.config/print-tracker/print-tracker.db`

Settings are stored in the same database, in a `settings` key/value table.
Deleting a folder stops tracking it and removes its indexed files, but
**print history is kept** — `print_events.file_id` is set to `NULL` instead of
cascading, and the document name is stored on the event itself.

## Project structure

```
src/
  shared/            types + IPC channel names used by all three processes
  main/
    db/              SQLite wrapper and versioned migrations
    services/        folders · files(index) · prints · watcher · spooler · settings
    util/            ISO date helpers
    app.ts           wires the services together
    ipc.ts           ipcMain handlers
    index.ts         window + app lifecycle
  preload/           contextBridge surface (window.api)
  renderer/          React UI (Dashboard, Folders, Files, Print history, Settings)
scripts/
  smoke-db.cjs       exercises the real schema against the SQLite driver
```

### Security posture

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (the
preload needs Node's `ipcRenderer`). The renderer reaches the main process only
through the typed `window.api` surface defined in `src/shared/types.ts`.

## Limitations

- The spooler `JobId` and the event-log `JobId` are correlated on a best-effort
  basis; if a job is recorded from both sources the `external_id` unique index
  prevents duplicates but a rare double entry is possible.
- Matching a spooled document name to an indexed file is fuzzy: exact file name
  first, then file name without its extension.
- Cloud placeholder files (OneDrive "files on demand") may report incorrect
  sizes until hydrated.
- Local day boundaries are used for the dashboard's "today" and "this week".
