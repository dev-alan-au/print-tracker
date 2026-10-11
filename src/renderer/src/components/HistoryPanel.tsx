import { useCallback, useEffect, useState } from 'react'
import type { Page, PrintEvent, PrintSource, Student, ToastMessage } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatDateTime, formatRelative } from '../lib/format'
import ManualPrintDialog from './ManualPrintDialog'
import PageHelp from './PageHelp'
import SourceBadge from './SourceBadge'

export default function HistoryPanel({
  student,
  refreshToken,
  onChanged,
  onToast
}: {
  /** Whose prints are listed. Everyone's would mix a class together. */
  student: Student | null
  refreshToken: number
  onChanged: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, tn, locale, note: noteText } = useI18n()
  const studentId = student?.id ?? null
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
          studentId,
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
  }, [studentId, source, debouncedSearch, onToast, refreshToken])

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
          <h1>{t('history.title')}</h1>
          <p>
            {tn(data.total, 'history.count.one', 'history.count.other')}
            {student ? ` · ${t('overview.forStudent', { name: student.name })}` : ''}
            {loading ? ` · ${t('common.refreshing')}` : ''}
          </p>
          <PageHelp page="history" />
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => setShowManual(true)}>
            {t('history.logPrint')}
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <input
            className="search"
            type="search"
            placeholder={t('history.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as 'all' | PrintSource)}
          >
            <option value="all">{t('history.allSources')}</option>
            <option value="watcher">{t('source.watcher')}</option>
            <option value="spooler">{t('source.spooler')}</option>
            <option value="app">{t('source.app')}</option>
            <option value="manual">{t('source.manual')}</option>
          </select>
          <span className="spacer" />
          <button type="button" className="btn tiny" onClick={() => void load()}>
            {t('common.refresh')}
          </button>
        </div>

        {data.items.length === 0 ? (
          <div className="empty">
            <strong>{loading ? t('history.loading') : t('history.emptyTitle')}</strong>
            {loading ? null : t('history.emptyBody')}
          </div>
        ) : (
          <div className="panel-body flush">
            <table>
              <thead>
                <tr>
                  <th>{t('history.table.printed')}</th>
                  <th>{t('history.table.document')}</th>
                  <th>{t('history.table.student')}</th>
                  <th>{t('history.table.source')}</th>
                  <th>{t('history.table.printer')}</th>
                  <th className="num">{t('history.table.copies')}</th>
                  <th className="num">{t('history.table.pages')}</th>
                  <th>{t('history.table.user')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((event) => {
                  // System notes are stored as keys so they follow the UI language;
                  // user-typed notes are shown verbatim.
                  const description = noteText(event.noteKey, event.noteParams) ?? event.note
                  return (
                    <tr key={event.id}>
                      <td>
                        <div>{formatRelative(event.printedAt, locale)}</div>
                        <div className="cell-sub">{formatDateTime(event.printedAt, locale)}</div>
                      </td>
                      <td>
                        <div className="cell-main">
                          {event.fileName ?? t('common.unknownDocument')}
                        </div>
                        {event.filePath ? <div className="cell-sub">{event.filePath}</div> : null}
                        {description ? <div className="cell-sub">{description}</div> : null}
                      </td>
                      <td className="cell-sub">
                        {event.studentName ?? t('common.emptyValue')}
                      </td>
                      <td>
                        <SourceBadge source={event.source} />
                      </td>
                      <td className="cell-sub">{event.printer ?? t('common.emptyValue')}</td>
                      <td className="num">{event.copies}</td>
                      <td className="num">{event.pages ?? t('common.emptyValue')}</td>
                      <td className="cell-sub">{event.userName ?? t('common.emptyValue')}</td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn tiny danger"
                            onClick={() => void remove(event)}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
