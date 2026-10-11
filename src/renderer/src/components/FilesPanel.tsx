import { useCallback, useEffect, useState } from 'react'
import type { FileQuery, Page, ToastMessage, TrackedFile, TrackedFolder } from '@shared/types'
import { useI18n } from '../i18n'
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
  const { t, tn, locale } = useI18n()
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

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('files.title')}</h1>
          <p>
            {tn(data.total, 'files.count.one', 'files.count.other')}
            {loading ? ` · ${t('common.refreshing')}` : ''}
          </p>
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

          <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="all">{t('files.allFolders')}</option>
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
              checked={onlyPrinted}
              onChange={(event) => setOnlyPrinted(event.target.checked)}
            />
            {t('files.printedOnly')}
          </label>

          <span className="spacer" />

          <button type="button" className="btn tiny" onClick={() => void load()}>
            {t('common.refresh')}
          </button>
        </div>

        {data.items.length === 0 ? (
          <div className="empty">
            <strong>{loading ? t('files.loading') : t('files.emptyTitle')}</strong>
            {loading ? null : t('files.emptyBody')}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>{t('files.table.file')}</th>
                  <th>{t('files.table.folder')}</th>
                  <th className="num">{t('files.table.size')}</th>
                  <th>{t('files.table.modified')}</th>
                  <th className="num">{t('files.table.prints')}</th>
                  <th>{t('files.table.lastPrinted')}</th>
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
                            <span className="badge neutral">{t('files.badge.missing')}</span>
                          </>
                        )}
                      </div>
                      <div className="cell-sub">{file.path}</div>
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
    </>
  )
}
