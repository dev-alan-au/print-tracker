import { useCallback, useEffect, useState } from 'react'
import type { Page, ToastMessage, TrackedFile } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes, formatRelative } from '../lib/format'
import PageHelp from './PageHelp'

const LIST_LIMIT = 500

/**
 * The default screen: two lists answering "what has been printed, and what has
 * not". Deliberately read-only - the Files screen is where you act on a file.
 */
export default function OverviewPanel({
  refreshToken,
  onToast
}: {
  refreshToken: number
  onToast: (toast: ToastMessage) => void
}) {
  const { t, tn, locale } = useI18n()
  const [printed, setPrinted] = useState<Page<TrackedFile>>({ items: [], total: 0 })
  const [notPrinted, setNotPrinted] = useState<Page<TrackedFile>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  // Search here is the same query the Files screen uses, so it also matches a
  // file's folder name and path - typing a folder narrows both lists to it.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [printedPage, unprintedPage] = await Promise.all([
        window.api.files.list({
          search: debouncedSearch,
          printed: 'printed',
          sort: 'lastPrinted',
          direction: 'desc',
          limit: LIST_LIMIT
        }),
        window.api.files.list({
          search: debouncedSearch,
          printed: 'unprinted',
          sort: 'name',
          direction: 'asc',
          limit: LIST_LIMIT
        })
      ])
      setPrinted(printedPage)
      setNotPrinted(unprintedPage)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const total = printed.total + notPrinted.total
  const term = debouncedSearch.trim()

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('overview.title')}</h1>
          <p>
            {loading
              ? t('overview.loading')
              : t('overview.summary', { printed: printed.total, total })}
            {term ? ` · ${t('overview.filtered', { term })}` : ''}
          </p>
          <PageHelp page="overview" />
        </div>
        <div className="row">
          <input
            className="search"
            type="search"
            placeholder={t('overview.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn" onClick={() => void load()}>
            {t('common.refresh')}
          </button>
        </div>
      </header>

      {/* Not printed comes first: it is the list you act on. */}
      <div className="grid-2 grid-2-even">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('overview.notPrinted.title')}</h2>
            <span className="spacer" />
            <span className="badge neutral">{notPrinted.total}</span>
          </div>
          {notPrinted.items.length === 0 ? (
            <div className="empty">
              {term ? t('overview.search.noMatch', { term }) : t('overview.notPrinted.empty')}
            </div>
          ) : (
            <div className="list list-scroll">
              {notPrinted.items.map((file) => (
                <div className="list-item" key={file.id}>
                  <span className="grow">
                    <div className="cell-main">{file.name}</div>
                    <div className="cell-sub">
                      {file.folderName ?? t('common.emptyValue')} · {formatBytes(file.size, locale)}
                    </div>
                  </span>
                  <span className="badge neutral">{t('common.never')}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('overview.printed.title')}</h2>
            <span className="spacer" />
            <span className="badge output">{printed.total}</span>
          </div>
          {printed.items.length === 0 ? (
            <div className="empty">
              {term ? t('overview.search.noMatch', { term }) : t('overview.printed.empty')}
            </div>
          ) : (
            <div className="list list-scroll">
              {printed.items.map((file) => (
                <div className="list-item" key={file.id}>
                  <span className="grow">
                    <div className="cell-main">{file.name}</div>
                    <div className="cell-sub">
                      {file.folderName ?? t('common.emptyValue')} ·{' '}
                      {file.lastPrintedAt
                        ? formatRelative(file.lastPrintedAt, locale)
                        : t('common.never')}
                    </div>
                  </span>
                  <span className="count-pill">
                    {tn(file.printedCount, 'unit.prints.one', 'unit.prints.other')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
