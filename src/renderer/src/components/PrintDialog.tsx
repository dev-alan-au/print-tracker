import { useCallback, useEffect, useState } from 'react'
import type {
  MessageKey,
  PrintFileResult,
  PrintMethod,
  PrinterInfo,
  ToastMessage
} from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import Modal from './Modal'

/**
 * Sends the selected files to a printer.
 *
 * The dialog deliberately states how printing works before it is used: the app
 * does not render or rasterise anything itself, it asks the operating system to
 * print, and whether that succeeds depends on a program being registered for
 * the file type. Saying so up front is better than an unexplained failure.
 */
export default function PrintDialog({
  fileIds,
  onClose,
  onPrinted,
  onToast
}: {
  fileIds: number[]
  onClose: () => void
  onPrinted: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, tn } = useI18n()
  const [method, setMethod] = useState<PrintMethod | null>(null)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [printer, setPrinter] = useState('')
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<PrintFileResult[] | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [nextMethod, list] = await Promise.all([
          window.api.files.method(),
          window.api.files.listPrinters()
        ])
        setMethod(nextMethod)
        setPrinters(list)
        setPrinter(list.find((entry) => entry.isDefault)?.name ?? '')
      } catch (caught) {
        onToast({ kind: 'error', message: errorMessage(caught) })
      }
    })()
  }, [onToast])

  const run = useCallback(async () => {
    setBusy(true)
    try {
      const report = await window.api.files.print({
        fileIds,
        printer: printer || null,
        copies
      })
      setResults(report.results)

      const sent = report.results.filter((result) => result.ok).length
      const total = report.results.length
      if (sent > 0) onPrinted()

      if (sent === 0) {
        onToast({ kind: 'error', messageKey: 'print.toast.none' })
      } else if (sent < total) {
        onToast({
          kind: 'warning',
          messageKey: 'print.toast.partial',
          messageParams: { ok: sent, total }
        })
      } else {
        onToast({
          kind: 'success',
          messageKey: 'print.toast.queued',
          messageParams: { count: sent }
        })
      }
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }, [copies, fileIds, onPrinted, onToast, printer])

  const unsupported = method === 'unsupported'
  const sent = results?.filter((result) => result.ok).length ?? 0

  return (
    <Modal
      title={t('print.title')}
      onClose={busy ? () => undefined : onClose}
      footer={
        results ? (
          <button type="button" className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        ) : (
          <>
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || unsupported}
              onClick={() => void run()}
            >
              {busy ? t('print.submitting') : t('print.submit')}
            </button>
          </>
        )
      }
    >
      <p>{tn(fileIds.length, 'print.selected.one', 'print.selected.other')}</p>

      {unsupported ? (
        <div className="note error">
          <strong>{t('print.unsupported.title')}</strong>
          <br />
          {t('print.unsupported.body')}
        </div>
      ) : null}

      {results ? (
        <>
          <div className="note">
            {t('print.result.summary', { ok: sent, total: results.length })}
          </div>
          <div className="list list-scroll print-results">
            {results.map((result) => (
              <div className="list-item" key={result.fileId}>
                <span className="grow">
                  <div className="cell-main">{result.name}</div>
                  {result.ok ? null : (
                    <div className="cell-sub">
                      {result.errorKey
                        ? t(result.errorKey as MessageKey)
                        : (result.error ?? t('print.result.failed'))}
                    </div>
                  )}
                </span>
                <span className={`badge ${result.ok ? 'output' : 'danger'}`}>
                  {result.ok ? t('print.result.ok') : t('print.result.failed')}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="panel-note print-intro">{t('print.intro')}</p>

          <div className="field">
            <label htmlFor="print-printer">{t('print.printer')}</label>
            <select
              id="print-printer"
              value={printer}
              disabled={busy}
              onChange={(event) => setPrinter(event.target.value)}
            >
              <option value="">{t('print.defaultPrinter')}</option>
              {printers.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                  {entry.isDefault ? ` — ${t('print.defaultPrinter')}` : ''}
                </option>
              ))}
            </select>
          </div>

          {printers.length === 0 && !unsupported ? (
            <div className="note">{t('print.printerUnknown')}</div>
          ) : null}

          <div className="field" style={{ maxWidth: 140, marginTop: 14 }}>
            <label htmlFor="print-copies">{t('print.copies')}</label>
            <input
              id="print-copies"
              type="number"
              min={1}
              max={99}
              value={copies}
              disabled={busy}
              onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
