import { useCallback, useEffect, useState } from 'react'
import type { Page, PrintEvent, PrintSource, ToastMessage } from '@shared/types'
import { errorMessage, formatDateTime, formatRelative } from '../lib/format'
import ManualPrintDialog from './ManualPrintDialog'
import SourceBadge from './SourceBadge'

export default function HistoryPanel({
  refreshToken,
  onChanged,
  onToast
}: {
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const [data, setData] = useState<Page<PrintEvent>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [source, setSource] = useState<'all' | PrintSource>('all')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(
        await window.api.prints.list({
          source: source === 'all' ? null : source,
          search: debouncedSearch,
          limit: 500
        })
      )
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setLoading(false)
    }
  }, [source, debouncedSearch, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (event: PrintEvent): Promise<void> => {
    try {
      await window.api.prints.remove(event.id)
      onChanged()
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Print history</h1>
          <p>
            {data.total} print event{data.total === 1 ? '' : 's'}
            {loading ? ' · refreshing…' : ''}
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => setShowManual(true)}>
            + Log a print
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <input
            className="search"
            type="search"
            placeholder="Search document, printer or note…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as 'all' | PrintSource)}
          >
            <option value="all">All sources</option>
            <option value="watcher">Folder watch</option>
            <option value="spooler">Spooler</option>
            <option value="manual">Manual</option>
          </select>
          <span className="spacer" />
          <button type="button" className="btn tiny" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {data.items.length === 0 ? (
          <div className="empty">
            <strong>{loading ? 'Loading history…' : 'No print events'}</strong>
            {loading ? null : 'Events appear here as folders or the print spooler report them.'}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>Printed</th>
                  <th>Document</th>
                  <th>Source</th>
                  <th>Printer</th>
                  <th className="num">Copies</th>
                  <th className="num">Pages</th>
                  <th>User</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <div>{formatRelative(event.printedAt)}</div>
                      <div className="cell-sub">{formatDateTime(event.printedAt)}</div>
                    </td>
                    <td>
                      <div className="cell-main">{event.fileName ?? 'Unknown document'}</div>
                      {event.filePath ? <div className="cell-sub">{event.filePath}</div> : null}
                      {event.note ? <div className="cell-sub">{event.note}</div> : null}
                    </td>
                    <td>
                      <SourceBadge source={event.source} />
                    </td>
                    <td className="cell-sub">{event.printer ?? '—'}</td>
                    <td className="num">{event.copies}</td>
                    <td className="num">{event.pages ?? '—'}</td>
                    <td className="cell-sub">{event.userName ?? '—'}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn tiny danger"
                          title="Delete this print event"
                          onClick={() => void remove(event)}
                        >
                          Delete
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

      {showManual ? (
        <ManualPrintDialog
          onClose={() => setShowManual(false)}
          onSaved={() => {
            setShowManual(false)
            onChanged()
          }}
          onToast={onToast}
        />
      ) : null}
    </>
  )
}
