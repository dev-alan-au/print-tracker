/**
 * SQLite schema.
 *
 * `MIGRATIONS[n]` upgrades the database from `user_version = n` to `n + 1`.
 * Never edit an existing entry once it has shipped - append a new one instead.
 */

export const SCHEMA_VERSION = 2

export const MIGRATIONS: readonly string[] = [
  /* v0 -> v1 : initial schema */
  `
  CREATE TABLE IF NOT EXISTS folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    kind       TEXT    NOT NULL DEFAULT 'library',
    recursive  INTEGER NOT NULL DEFAULT 1,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id       INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    path            TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    ext             TEXT,
    size            INTEGER NOT NULL DEFAULT 0,
    mtime           TEXT,
    present         INTEGER NOT NULL DEFAULT 1,
    first_seen_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    last_seen_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    printed_count   INTEGER NOT NULL DEFAULT 0,
    last_printed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
  CREATE INDEX IF NOT EXISTS idx_files_name   ON files(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS print_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER REFERENCES files(id) ON DELETE SET NULL,
    source        TEXT    NOT NULL,
    printer       TEXT,
    document_name TEXT,
    copies        INTEGER NOT NULL DEFAULT 1,
    pages         INTEGER,
    user_name     TEXT,
    status        TEXT,
    note          TEXT,
    external_id   TEXT,
    printed_at    TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_print_events_date ON print_events(printed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_print_events_file ON print_events(file_id);
  /* SQLite treats NULLs as distinct in unique indexes, so external_id may be
     NULL for manual events without collisions. */
  CREATE UNIQUE INDEX IF NOT EXISTS idx_print_events_external ON print_events(external_id);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,

  /* v1 -> v2 : localisable notes.
     Notes the application generates itself store a message key plus placeholder
     values instead of a finished English sentence, so stored history re-renders
     in whichever language the user selects later. `note` stays reserved for
     free text typed by the user. */
  `
  ALTER TABLE print_events ADD COLUMN note_key    TEXT;
  ALTER TABLE print_events ADD COLUMN note_params TEXT;
  `
]
