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

## Four ways a print gets recorded

| Source           | How it works                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Folder watch** | Folders can be marked as **output / spool**. A file that appears there after startup counts as a print. Ideal for "print to folder" workflows. |
| **Spooler**      | On Windows, Print Tracker reads the `Microsoft-Windows-PrintService/Operational` event log (event id 307) and polls the live print queue.      |
| **From the app** | Select one or more files in **Files** and press **Print selected…**. Recorded as `app`, so history shows it was started here.                  |
| **Manual**       | A "Mark printed" / "Log a print" button for anything the app cannot observe.                                                                   |

### Printing from inside the app

**Files → tick one or more rows → Print selected…**

Print Tracker does not render or rasterise documents itself. It hands each file
to the operating system, using the same program that would normally print it:

| Platform      | Mechanism                                                             |
| ------------- | --------------------------------------------------------------------- |
| Windows       | `Start-Process -Verb Print` (or `PrintTo` when a printer is chosen)    |
| macOS / Linux | CUPS, via `lp [-d printer] [-n copies] -- path`                        |

Consequences worth knowing:

- A file prints only if something on the machine can print that type. A `.pdf`
  or `.txt` usually can; a `.docx` needs Word or similar installed. A file
  nothing can handle is reported per file rather than failing the batch.
- The command is written to the PowerShell command line **base64-encoded**, so a
  quote in a filename cannot break out into the script.
- A job is recorded **only once the system accepts it**. If `lp` or the Windows
  verb fails, nothing is added to the history - the point of the feature is to
  make the history truthful, so recording an attempt would defeat it.
- The files are checked for existence before the OS is asked, so a row whose
  file has since been deleted says so in our own words.

#### Why an app print is not counted twice

The spooler sees *every* job, including the ones this app queued, so on Windows
a single print would otherwise appear twice - once as `app` and once as
`spooler` - with a doubled counter. `PrintService` therefore drops a spooler or
watcher event for a file that the app itself printed in the last 60 seconds.

The window is deliberately generous, because the spooler polls on an interval
rather than instantly. The trade-off is the opposite failure: printing a file
from the app and then reprinting the same file from its own application within
that minute is recorded once. Manual entries are never suppressed, since the
user asserting a print outranks any inference.

Extra details are captured where available: printer, user, copies, pages and afree-text note.

### Folder roles

- **Library** — indexed and searchable, no automatic print events.
- **Output / spool** — indexed **and** every new file is recorded as a print.

A file in an output folder is only counted once it has stopped changing for
`minFileStabilityMs` (default 1.5 s), so multi-pass writes do not produce
duplicate prints.

### Filtering by folder and subfolder
The **Files** screen's folder filter offers each tracked folder under its own
group, with the subfolders inside it:

```
All folders
  library
    Everything in this folder
    reports (1)
  output
```

Filtering by the folder was always enough to see the files in its
subdirectories, because every file a recursive scan finds shares that folder's
id. The extra options narrow that down to one directory, and each one is a path
prefix, so picking `reports` also covers `reports/2026`.

Two details worth knowing:

- Subfolders are derived from the **indexed file rows**, not by walking the
  disk. The filter can therefore never offer a directory that turns out to be
  empty, and the count beside it matches what you will see.
- The prefix test uses `substr` rather than `LIKE`. On Windows the path
  separator is the same character as `LIKE`'s escape, which makes a pattern for
  a Windows path a trap, and a directory named `nestedish` must not be swept in
  by a filter for `nested`.

### Notes on a file

**Files → Notes** on any row, up to 255 characters. The counter beside the box
shows how much of the budget is used, and a dot in the list marks the rows that
carry one.

Two things it deliberately is not:

- It is not `print_events.note`, which belongs to a single print. This note
  belongs to the *file*, so it survives being reprinted and is not duplicated
  across a file's history.
- It is not lost on rescan. `FileService.upsertFromDisk` refreshes the columns
  that come from the filesystem and leaves `notes` alone.

The cap is enforced in the main process, not only by the textarea's `maxLength`:
the renderer is not the only way to reach the IPC channel, and a silently
truncated note would be worse than a refused one. Whitespace-only input clears
the note rather than storing blanks.

## Who is using the app

Every screen that shows prints has to answer "whose?", so Print Tracker asks
first: a picker replaces the app on launch until a student is chosen, and the
sidebar shows who it is with a **Change** link that reopens the same picker.

A student is a name. Nothing else - no class, no enrolment number, no contact
details, because anything more turns a classroom helper into a student
information system, with obligations this app cannot meet.

A print is attributed to whoever was using the app when it was recorded. That
includes prints found by the watcher and the spooler, which happen while nobody
is looking at the screen: the current student is held in the **main process** for
exactly that reason, rather than in the window.

| Follows the student                                                      | Stays shared                       |
| ------------------------------------------------------------------------ | ---------------------------------- |
| Print history, and the count beside its nav item                         | The folder list and the file index |
| Files: the print count, printed / not printed, and both sort orders       | The files themselves               |
| Overview: both lists and the summary line                                |                                    |
| Dashboard: every print figure, the charts and the recent list            | Dashboard's folder and file totals |

So "not printed" means **not printed by them**, and the same file can be printed
for one student and unprinted for another.

Attribution is stored as both an id and the name as it was at the time. Two
consequences, both deliberate:

- **Removing a student does not remove their history.** The events survive with
their id set to `NULL` and their name intact, so old records still say who they
were for. The confirmation dialog says so too, because "Delete" would otherwise
read as "delete their records as well".
- **Renaming does not rewrite the past.** An event keeps the name it was
recorded under, so a rename cannot retroactively attribute an old print to a
different person.

Names are unique case-insensitively, so the list cannot hold both "Alice" and
"alice" and leave you choosing between two identical rows.

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

Because screenshots are useless for anything behind a click or a keystroke, two
more variables drive the UI while the shots are taken:

| Variable                       | Effect                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| `PT_DEBUG_SEARCH=<term>`       | Types the term into the search box on Overview, Files and History.          |
| `PT_DEBUG_RESET=open`          | Opens the reset dialog on the Settings screen.                              |
| `PT_DEBUG_RESET=apply`         | Also types the confirmation and clicks through, performing a real reset.    |
| `PT_DEBUG_RESTORE=<row>`       | Opens the restore dialog for that snapshot row (0 is the newest).           |
| `PT_DEBUG_HELP=1`              | Expands the "what is this page?" explainer on every screen.                 |
| `PT_DEBUG_SELECT=<n>`          | Ticks the first `n` rows on the Files screen.                               |
| `PT_DEBUG_PRINT=1`             | Opens the print dialog for them; `=apply` also presses Print.               |
| `PT_DEBUG_NOTES=open`          | Opens the note dialog for the first file; `=apply` also saves it.           |
| `PT_DEBUG_FILTER=<value>`      | Selects that option in the folder filter.                                   |
| `PT_DEBUG_DRAG=<column>,<px>`  | Drags a column edge, to check the widths stick.                             |
| `PT_DEBUG_STUDENT=<name>`      | Answers the student picker at launch, creating the student if needed.       |
| `PT_DEBUG_STUDENT_UI=picker`   | Opens the sidebar switcher over the first screen.                           |
| `PT_DEBUG_STUDENT_UI=rename`   | Opens the rename dialog on the Students screen.                             |

Without `PT_DEBUG_STUDENT` every screenshot shows the student picker instead of
the app, since nothing behind it can be reached until somebody is chosen. Running
against seeded data is often what you want:

```bash
npm run seed:demo                              # rebuild /tmp/print-tracker-demo-data
PT_DEBUG=1 PT_DEBUG_STUDENT=Lena PT_DEBUG_SHOT=/tmp/ui.png \
  npx electron --user-data-dir=/tmp/print-tracker-demo-data .
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

#### Packaging never publishes (`GH_TOKEN`)

`electron-builder.yml` sets `publish: null` and `build:win` passes
`--publish never`. Both are deliberate.

Left unset, electron-builder inspects the git remote, infers a GitHub provider,
and applies an implicit policy of its own: `onTagOrDraft` as soon as it detects
CI, or `onTag` on a tag. For GitHub that policy really does publish, so it asks
for `GH_TOKEN` and aborts the build with:

```
⨯ GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"
```

The `windows` job has no token - only `release` does, and it publishes with the
`gh` CLI - so leaving this unset would fail CI on **every** push rather than only
on tags. It also meant a developer with `GH_TOKEN` exported could publish a
release from their own machine by running `npm run build:win`.

Note that other providers are skipped when the build is not for a tag; GitHub is
explicitly excluded from that shortcut, which is why this bites on branch builds.

To publish from electron-builder deliberately, override it for one run:

```bash
GH_TOKEN=... npx electron-builder --win --publish always --config electron-builder.yml
```

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

### Snapshots

A `backups/` folder sits next to the database. A snapshot is written on every
launch and prunes to the ten newest, so a bad session can be rolled back.

Snapshots come from SQLite's `VACUUM INTO`, never a file copy: with WAL enabled
the newest writes live in the `-wal` sidecar, so copying the `.db` alone would
silently lose them. `VACUUM INTO` writes one consistent file.

### Restoring, and what "file check" means

**Settings → Restore from file…**, or **Restore** on any snapshot in the list.

Nothing is written until the candidate has been checked. It is attached to the
live connection and asked:

| Check                | Refuses when                                                       |
| -------------------- | ------------------------------------------------------------------ |
| File                 | missing, a directory, or empty                                      |
| `integrity_check`    | the database is damaged                                             |
| Required tables      | `folders`, `files`, `print_events` or `settings` is absent          |
| Required columns     | a table the copy depends on lacks a column it needs                 |
| `user_version`       | the snapshot came from a *newer* build of the app                   |
| `foreign_key_check`  | the database references rows that are not in it                     |
| Self-reference       | the file *is* the database the app is currently using               |

Only when every check passes does the dialog report what the snapshot contains
and enable **Restore now**. The current data is snapshotted first, so a restore
is itself reversible.

The rows are copied into the existing schema rather than the file being
swapped. A snapshot from an older build therefore restores cleanly: columns it
lacks are left at their defaults, and no migration has to be replayed.

### Resetting

**Settings → Danger zone → Reset application…** returns the app to a first-run
state: folders, indexed files, print events and settings are all deleted. Your
documents are untouched.

It deletes rows rather than the database file, so the schema, indexes and
`user_version` survive, and `sqlite_sequence` is cleared so ids start at 1
again. The dialog shows the counts it is about to destroy, offers a snapshot by
default, and requires typing a confirmation word.

## Project structure

```
src/
  shared/            types + IPC channel names used by all three processes
  shared/i18n/       message catalogues (en, ko) and translation helpers
  main/
    db/              SQLite wrapper and versioned migrations
    services/        folders · files(index) · prints · printer · watcher · spooler · settings
                     backups · query · reset · restore
    util/            ISO date helpers
    app.ts           wires the services together
    ipc.ts           ipcMain handlers
    index.ts         window + app lifecycle
  preload/           contextBridge surface (window.api)
  renderer/          React UI (Overview, Dashboard, Folders, Files, Print history,
                     Query, Settings)
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
