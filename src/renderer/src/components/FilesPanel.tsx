import { useCallback, useEffect, useState } from 'react'
import type { FileQuery, Page, ToastMessage, TrackedFile, TrackedFolder } from '@shared/types'
import { errorMessage, formatBytes, formatDateTime, formatRelative } from '../lib/format'
import ManualPrintDialog from './ManualPrintDialog'

export default function FilesPanel({
  refreshToken,
  onChanged,
  onToast
}: {
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const [folders, setFolders] = useState<TrackedFolder[]>([])
  const [data, setData] = useState<Page<TrackedFile>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [folderId, setFolderId] = useState<string>('all')
  const [onlyPrinted, setOnlyPrinted] = useState(false)
  const [sort, setSort] = useState<NonNullable<FileQuery['sort']>>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const [manualFor, setManualFor] = useState<TrackedFile | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [folderList, page] = await Promise.all([
        window.api.folders.list(),
        window.api.files.list({
          folderId: folderId === 'all' ? null : Number(folderId),
          search: debouncedSearch,
          onlyPrinted,
          sort,
          direction,
          limit: 500
        })
      ])
      setFolders(folderList)
      setData(page)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setLoading(false)
    }
  }, [folderId, debouncedSearch, onlyPrinted, sort, direction, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const removeFromIndex = async (file: TrackedFile): Promise<void> => {
    const confirmed = window.confirm(
      `Remove "${file.name}" from the index?\n\nThe file on disk is not touched. Recorded print history is kept.`
    )
    if (!confirmed) return
    try {
      await window.api.files.remove(file.id)
      onToast({ kind: 'info', message: `Removed "${file.name}" from the index.` })
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

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Files</h1>
          <p>
            {data.total} indexed file{data.total === 1 ? '' : 's'}
            {loading ? ' · refreshing…' : ''}
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <input
            className="search"
            type="search"
            placeholder="Search name or path…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="all">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={String(folder.id)}>
                {folder.name}
              </option>
            ))}
          </select>

          <select
            value={`${sort}:${direction}`}
            onChange={(event) => {
              const [nextSort, nextDirection] = event.target.value.split(':')
              setSort(nextSort as NonNullable<FileQuery['sort']>)
              setDirection(nextDirection as 'asc' | 'desc')
            }}
          >
            <option value="name:asc">Name A→Z</option>
            <option value="name:desc">Name Z→A</option>
            <option value="recent:desc">Recently changed</option>
            <option value="prints:desc">Most printed</option>
            <option value="size:desc">Largest</option>
          </select>

          <label className="check">
            <input
              type="checkbox"
              checked={onlyPrinted}
              onChange={(event) => setOnlyPrinted(event.target.checked)}
            />
            printed only
          </label>

          <span className="spacer" />

          <button type="button" className="btn tiny" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {data.items.length === 0 ? (
          <div className="empty">
            <strong>{loading ? 'Loading files…' : 'No files match'}</strong>
            {loading
              ? null
              : 'Add a folder to track, or loosen the filters above.'}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Folder</th>
                  <th className="num">Size</th>
                  <th>Modified</th>
                  <th className="num">Prints</th>
                  <th>Last printed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="cell-main">
                        {file.name}
                        {file.present ? null : (
                          <>
                            {' '}
                            <span className="badge neutral">missing</span>
                          </>
                        )}
                      </div>
                      <div className="cell-sub">{file.path}</div>
                    </td>
                    <td className="cell-sub">{file.folderName ?? '—'}</td>
                    <td className="num">{formatBytes(file.size)}</td>
                    <td className="cell-sub">{formatDateTime(file.mtime)}</td>
                    <td className="num">
                      {file.printedCount > 0 ? (
                        <span className="count-pill">{file.printedCount}</span>
                      ) : (
                        <span className="hint">0</span>
                      )}
                    </td>
                    <td className="cell-sub">{formatRelative(file.lastPrintedAt)}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => setManualFor(file)}
                        >
                          Mark printed
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => void openFile(file)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => revealFile(file)}
                        >
                          Locate
                        </button>
                        <button
                          type="button"
                          className="btn tiny danger"
                          onClick={() => void removeFromIndex(file)}
                        >
                          Remove
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
    </>
  )
}
