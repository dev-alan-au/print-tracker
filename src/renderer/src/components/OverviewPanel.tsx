import { useCallback, useEffect, useState } from 'react'
import type { Page, ToastMessage, TrackedFile } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes, formatRelative } from '../lib/format'

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [printedPage, unprintedPage] = await Promise.all([
        window.api.files.list({
          printed: 'printed',
          sort: 'lastPrinted',
          direction: 'desc',
          limit: LIST_LIMIT
        }),
        window.api.files.list({
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
  }, [onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const total = printed.total + notPrinted.total

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('overview.title')}</h1>
          <p>
            {loading
              ? t('overview.loading')
              : t('overview.summary', { printed: printed.total, total })}
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => void load()}>
            {t('common.refresh')}
          </button>
        </div>
      </header>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('overview.printed.title')}</h2>
            <span className="spacer" />
            <span className="badge output">{printed.total}</span>
          </div>
          {printed.items.length === 0 ? (
            <div className="empty">{t('overview.printed.empty')}</div>
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

        <section className="panel">
          <div className="panel-head">
            <h2>{t('overview.notPrinted.title')}</h2>
            <span className="spacer" />
            <span className="badge neutral">{notPrinted.total}</span>
          </div>
          {notPrinted.items.length === 0 ? (
            <div className="empty">{t('overview.notPrinted.empty')}</div>
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
      </div>
    </>
  )
}
