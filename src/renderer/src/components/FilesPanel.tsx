import { useCallback, useEffect, useState } from 'react'
import type {
  FileQuery,
  FolderDirectory,
  Page,
  ToastMessage,
  TrackedFile,
  TrackedFolder
} from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes, formatDateTime, formatRelative } from '../lib/format'
import { useColumnWidths } from '../lib/useColumnWidths'
import ManualPrintDialog from './ManualPrintDialog'
import NotesDialog from './NotesDialog'
import PageHelp from './PageHelp'
import PrintDialog from './PrintDialog'
import { ResizableTh } from './ResizableTable'

/**
 * Table columns, in order. `pick` is the row checkbox and stays a fixed sliver.
 * Widths are only a starting point for the ones that carry a default - until the
 * user drags an edge the table sizes its own columns.
 */
const FILE_COLUMNS: { key: string; defaultWidth?: number }[] = [
  { key: 'pick', defaultWidth: 34 },
  { key: 'file' },
  { key: 'folder' },
  { key: 'size' },
  { key: 'modified' },
  { key: 'prints' },
  { key: 'lastPrinted' },
  { key: 'actions' }
]

/** Stable identity: the hook measures these in header order. */
const FILE_COLUMN_KEYS = FILE_COLUMNS.map((column) => column.key)

export default function FilesPanel({
  refreshToken,
  onChanged,
  onToast
}: {
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, tn, locale } = useI18n()
  const [folders, setFolders] = useState<TrackedFolder[]>([])
  const [data, setData] = useState<Page<TrackedFile>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  /**
   * What the folder filter is scoped to: `all`, `folder:<id>`, or
   * `dir:<absolute path>` for a subfolder of one of them.
   */
  const [scope, setScope] = useState('all')
  const [directories, setDirectories] = useState<FolderDirectory[]>([])
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'unprinted'>('all')
  const [sort, setSort] = useState<NonNullable<FileQuery['sort']>>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const [manualFor, setManualFor] = useState<TrackedFile | null>(null)
  const [notesFor, setNotesFor] = useState<TrackedFile | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [printOpen, setPrintOpen] = useState(false)
  const columns = useColumnWidths('files', FILE_COLUMN_KEYS)
  // Auto layout while the table is in charge, fixed once the user has taken
  // over: fixed layout is what makes a dragged width stick, and forcing it from
  // the start would replace sensible content sizing with equal columns.
  const hasWidths = Object.keys(columns.widths).length > 0

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Parsed here rather than in state, so the scope stays a plain string for
      // the select while the query gets the shape it wants. Anything this does
      // not recognise - including the empty string a select reports when its
      // value is unknown - means "no folder filter" rather than a filter that
      // silently matches nothing.
      const scopeQuery: FileQuery = scope.startsWith('dir:')
        ? { directory: scope.slice('dir:'.length) }
        : scope.startsWith('folder:')
          ? { folderId: Number(scope.slice('folder:'.length)) }
          : {}

      const [folderList, page, dirs] = await Promise.all([
        window.api.folders.list(),
        window.api.files.list({
          ...scopeQuery,
          search: debouncedSearch,
          printed: printFilter === 'all' ? undefined : printFilter,
          sort,
          direction,
          limit: 500
        }),
        window.api.files.directories()
      ])
      setFolders(folderList)
      setData(page)
      setDirectories(dirs)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setLoading(false)
    }
  }, [scope, debouncedSearch, printFilter, sort, direction, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const removeFromIndex = async (file: TrackedFile): Promise<void> => {
    const confirmed = window.confirm(t('files.confirmRemove', { name: file.name }))
    if (!confirmed) return
    try {
      await window.api.files.remove(file.id)
      onToast({ kind: 'info', messageKey: 'files.toast.removed', messageParams: { name: file.name } })
      onChanged()
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  const openFile = async (file: TrackedFile): Promise<void> => {
    try {
      await window.api.files.open(file.id)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  const revealFile = (file: TrackedFile): void => {
    void window.api.files.reveal(file.id).catch((caught: unknown) => {
      onToast({ kind: 'error', message: errorMessage(caught) })
    })
  }

  const toggleOne = (id: number): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * Selection is kept across reloads but pruned to what is on screen, so a
   * file that scrolled out of the filter cannot be printed by accident.
   */
  const visibleIds = data.items.map((file) => file.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected

  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current
      const allowed = new Set(visibleIds)
      const next = new Set([...current].filter((id) => allowed.has(id)))
      return next.size === current.size ? current : next
    })
    // Keyed on the page itself: `visibleIds` is derived from it every render.
  }, [data.items])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('files.title')}</h1>
          <p>
            {tn(data.total, 'files.count.one', 'files.count.other')}
            {loading ? ` · ${t('common.refreshing')}` : ''}
          </p>
          <PageHelp page="files" />
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <input
            className="search"
            type="search"
            placeholder={t('files.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">{t('files.allFolders')}</option>
            {folders.map((folder) => {
              const subfolders = directories.filter((entry) => entry.folderId === folder.id)
              // A folder with nothing nested needs no group around one option.
              if (subfolders.length === 0) {
                return (
                  <option key={folder.id} value={`folder:${folder.id}`}>
                    {folder.name}
                  </option>
                )
              }
              return (
                <optgroup key={folder.id} label={folder.name}>
                  <option value={`folder:${folder.id}`}>{t('files.wholeFolder')}</option>
                  {subfolders.map((entry) => (
                    <option key={entry.path} value={`dir:${entry.path}`}>
                      {t('files.directoryOption', {
                        name: entry.label,
                        count: entry.fileCount
                      })}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>

          <select
            value={`${sort}:${direction}`}
            onChange={(event) => {
              const [nextSort, nextDirection] = event.target.value.split(':')
              setSort(nextSort as NonNullable<FileQuery['sort']>)
              setDirection(nextDirection as 'asc' | 'desc')
            }}
          >
            <option value="name:asc">{t('files.sort.nameAsc')}</option>
            <option value="name:desc">{t('files.sort.nameDesc')}</option>
            <option value="recent:desc">{t('files.sort.recent')}</option>
            <option value="prints:desc">{t('files.sort.prints')}</option>
            <option value="lastPrinted:desc">{t('files.sort.lastPrinted')}</option>
            <option value="size:desc">{t('files.sort.size')}</option>
          </select>

          <label className="check">
            <input
              type="checkbox"
              checked={printFilter === 'printed'}
              onChange={(event) => setPrintFilter(event.target.checked ? 'printed' : 'all')}
            />
            {t('files.printedOnly')}
          </label>

          {/* The two are opposite ends of one choice, so checking either clears
              the other rather than letting both be on and match nothing. */}
          <label className="check">
            <input
              type="checkbox"
              checked={printFilter === 'unprinted'}
              onChange={(event) => setPrintFilter(event.target.checked ? 'unprinted' : 'all')}
            />
            {t('files.notPrintedOnly')}
          </label>

          <span className="spacer" />

          <button type="button" className="btn tiny" onClick={() => void load()}>
            {t('common.refresh')}
          </button>
        </div>

        {selectedVisible.length > 0 ? (
          <div className="selection-bar">
            <strong>{tn(selectedVisible.length, 'files.selected.one', 'files.selected.other')}</strong>
            <button
              type="button"
              className="btn tiny primary"
              onClick={() => setPrintOpen(true)}
            >
              {t('files.printSelected')}
            </button>
            <span className="spacer" />
            <button type="button" className="btn tiny ghost" onClick={() => setSelected(new Set())}>
              {t('files.clearSelection')}
            </button>
          </div>
        ) : null}

        {data.items.length === 0 ? (
          <div className="empty">
            <strong>{loading ? t('files.loading') : t('files.emptyTitle')}</strong>
            {loading ? null : t('files.emptyBody')}
          </div>
        ) : (
          <div className="panel-body flush">
            <table className={hasWidths ? 'fixed-layout' : undefined}>
              <colgroup>
                {FILE_COLUMNS.map((column) => (
                  <col
                    key={column.key}
                    style={
                      columns.widths[column.key] !== undefined
                        ? { width: columns.widths[column.key] }
                        : column.defaultWidth !== undefined
                          ? { width: column.defaultWidth }
                          : undefined
                    }
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="pick">
                    <input
                      type="checkbox"
                      aria-label={t('files.selectAll')}
                      checked={allVisibleSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = someVisibleSelected
                      }}
                      onChange={(event) =>
                        setSelected(event.target.checked ? new Set(visibleIds) : new Set())
                      }
                    />
                  </th>
                  <ResizableTh columnKey="file" columns={columns} minimum={160}>
                    {t('files.table.file')}
                  </ResizableTh>
                  <ResizableTh columnKey="folder" columns={columns} minimum={90}>
                    {t('files.table.folder')}
                  </ResizableTh>
                  <ResizableTh columnKey="size" columns={columns} className="num" minimum={70}>
                    {t('files.table.size')}
                  </ResizableTh>
                  <ResizableTh columnKey="modified" columns={columns} minimum={110}>
                    {t('files.table.modified')}
                  </ResizableTh>
                  <ResizableTh columnKey="prints" columns={columns} className="num" minimum={70}>
                    {t('files.table.prints')}
                  </ResizableTh>
                  <ResizableTh columnKey="lastPrinted" columns={columns} minimum={100}>
                    {t('files.table.lastPrinted')}
                  </ResizableTh>
                  <ResizableTh columnKey="actions" columns={columns} minimum={200} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((file) => (
                  <tr key={file.id} className={selected.has(file.id) ? 'is-selected' : undefined}>
                    <td className="pick">
                      <input
                        type="checkbox"
                        aria-label={t('files.selectFile', { name: file.name })}
                        checked={selected.has(file.id)}
                        onChange={() => toggleOne(file.id)}
                      />
                    </td>
                    <td>
                      <div className="cell-main">
                        {file.name}
                        {file.notes ? (
                          <span className="note-dot" title={t('files.notes.hasNote')} />
                        ) : null}
                        {file.present ? null : (
                          <>
                            {' '}
                            <span className="badge neutral">{t('files.badge.missing')}</span>
                          </>
                        )}
                      </div>
                      {/* Relative to the watched folder, with the full path on
                          hover: the absolute path is mostly the same for every
                          row, so showing it verbatim buries the useful part. */}
                      <div className="cell-sub" title={file.path}>
                        {file.relativePath}
                      </div>
                      {file.notes ? <div className="cell-sub notes-line">{file.notes}</div> : null}
                    </td>
                    <td className="cell-sub">{file.folderName ?? t('common.emptyValue')}</td>
                    <td className="num">{formatBytes(file.size, locale)}</td>
                    <td className="cell-sub">{formatDateTime(file.mtime, locale)}</td>
                    <td className="num">
                      {file.printedCount > 0 ? (
                        <span className="count-pill">{file.printedCount}</span>
                      ) : (
                        <span className="hint">0</span>
                      )}
                    </td>
                    <td className="cell-sub">{formatRelative(file.lastPrintedAt, locale)}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => setNotesFor(file)}
                        >
                          {t('files.notes')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => setManualFor(file)}
                        >
                          {t('files.markPrinted')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => void openFile(file)}
                        >
                          {t('common.open')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => revealFile(file)}
                        >
                          {t('common.locate')}
                        </button>
                        <button
                          type="button"
                          className="btn tiny danger"
                          onClick={() => void removeFromIndex(file)}
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {manualFor ? (
        <ManualPrintDialog
          fileId={manualFor.id}
          documentName={manualFor.name}
          onClose={() => setManualFor(null)}
          onSaved={() => {
            setManualFor(null)
            onChanged()
          }}
          onToast={onToast}
        />
      ) : null}

      {notesFor ? (
        <NotesDialog
          file={notesFor}
          onClose={() => setNotesFor(null)}
          onSaved={() => {
            setNotesFor(null)
            onChanged()
          }}
          onToast={onToast}
        />
      ) : null}

      {printOpen ? (
        <PrintDialog
          fileIds={selectedVisible}
          onClose={() => setPrintOpen(false)}
          onPrinted={onChanged}
          onToast={onToast}
        />
      ) : null}
    </>
  )
}
