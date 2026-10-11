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
npm test             # database + i18n + end-to-end suites
npm run seed:demo    # fill a throwaway data dir with demo data for UI review
npm run build:win    # Windows NSIS installer into release/
npm run build:dir    # unpacked build, no installer
```

### Debugging the UI

```bash
PT_DEBUG=1 npm run dev                             # report renderer state once it has loaded
PT_DEBUG=1 PT_DEBUG_SHOT=/tmp/ui.png npm run dev   # ...and write one PNG per screen
```

Handy on a machine you cannot look at directly (remote box, CI, bug report).
`PT_DEBUG` logs whether `window.api` reached the renderer and how the app mounted;
`PT_DEBUG_SHOT` also walks the navigation and saves a screenshot of each screen.

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

`npm run build:win` produces two artifacts in `release/`:

| File                                     | What it is                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `print-tracker-<version>-setup.exe`      | NSIS installer - per-user, changeable install directory, desktop and Start menu links |
| `print-tracker-<version>-portable.exe`   | Single file that runs with no installation step                                       |

Both are configured in `electron-builder.yml`.

Building locally from Linux works, but electron-builder needs **Wine** to stamp
the executable's version information - **CI is the easier path**.

Because the SQLite driver is pure WebAssembly, the same `node_modules` produce a
correct Windows build with no cross-compilation of native code.

### Getting a downloadable exe from GitHub

`.github/workflows/windows-build.yml` runs three jobs:

| Job       | When                                    | Result                                                        |
| --------- | --------------------------------------- | ------------------------------------------------------------- |
| `verify`  | every push and pull request             | typecheck plus all three test suites                          |
| `windows` | push to `main`, tags, manual runs       | builds both exes, uploads them as a workflow artifact          |
| `release` | tags matching `v*`                      | attaches the exes to a GitHub Release                          |

There are two ways to get the exe:

1. **Ad hoc** - open the **Actions** tab, pick *Windows build*, press
   **Run workflow**, then download `print-tracker-windows` from the Artifacts
   section of that run.
2. **Versioned release** - tag a commit and push it:

   ```bash
   npm version patch        # bumps package.json and creates the tag
   git push --follow-tags
   ```

   Both exes then appear under **Releases**, which is the link to hand to users.

Pull requests only run `verify`: Windows runners are billed at a higher rate and
a PR does not need an installer. No repository secrets are required - the release
job uses the automatically provided `GITHUB_TOKEN`.

## Languages

The interface ships in **English** and **Korean**. Choose one in
**Settings → Language**; the choice is stored in the database so it survives
restarts, and `System default` follows the operating system locale.

Everything the user sees is translated: navigation, tables, dialogs, empty
states, relative timestamps (via `Intl.RelativeTimeFormat`) and the notes
attached to automatically detected prints.

### Notes are stored as keys, not sentences

A print event recorded by the folder watcher or the spooler stores a message key
plus its parameters (`note_key` / `note_params`) rather than a finished English
sentence, so history re-renders in whichever language is selected later.
Free-text notes typed by the user are stored verbatim and never translated.

Toasts raised by the main process work the same way: they carry a `messageKey`
and the renderer resolves it. Only technical failures (a permission error, say)
are passed through as raw text, because they are not translatable messages.

The chosen language is also mirrored into `localStorage` so the first paint is
already correct instead of flashing the default while settings load from the
database.

### Adding a language

1. Copy `src/shared/i18n/en.ts` to `src/shared/i18n/<locale>.ts`, translate the
   values and keep the `{placeholders}` intact.
2. Type it as `Catalog`. TypeScript then fails the build if a key is missing or
   misspelled.
3. Register it in `src/shared/i18n/index.ts` (`CATALOGS`, `LOCALES`,
   `LOCALE_LABELS`) and add the tag to the `Locale` union in
   `src/shared/i18n/types.ts`.
4. Run `npm run test:i18n`, which checks key parity, placeholder parity, empty
   strings, unbalanced plural pairs and locale resolution.

Plurals use `Intl.PluralRules`: English has distinct `.one` / `.other` strings,
while Korean has a single plural category so its two variants are identical.

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
  shared/i18n/       message catalogues (en, ko) and translation helpers
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
  check-i18n.ts      translation catalogue consistency
  e2e-core.ts        runs the services end-to-end on plain Node
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
