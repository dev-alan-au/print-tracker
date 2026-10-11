import { useEffect, useState } from 'react'
import type { ToastMessage } from '@shared/types'
import { errorMessage } from '../lib/format'
import Modal from './Modal'

function toLocalInputValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export default function ManualPrintDialog({
  fileId = null,
  documentName = '',
  onClose,
  onSaved,
  onToast
}: {
  fileId?: number | null
  documentName?: string
  onClose: () => void
  onSaved: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const [name, setName] = useState(documentName)
  const [printer, setPrinter] = useState('')
  const [copies, setCopies] = useState('1')
  const [pages, setPages] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(() => toLocalInputValue(new Date()))
  const [printers, setPrinters] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.spooler
      .listPrinters()
      .then(setPrinters)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (fileId !== null) return
    void window.api.files
      .list({ limit: 300, sort: 'name', direction: 'asc' })
      .then((page) => setSuggestions(page.items.map((item) => item.name)))
      .catch(() => undefined)
  }, [fileId])

  const save = async (): Promise<void> => {
    const documentForEvent = fileId !== null ? name : name.trim()
    if (fileId === null && !documentForEvent) {
      setError('Enter a document name, or pick one of the indexed files.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await window.api.prints.addManual({
        fileId,
        documentName: documentForEvent || null,
        printer: printer.trim() || null,
        copies: Math.max(1, Number(copies) || 1),
        pages: pages.trim() ? Number(pages) : null,
        note: note.trim() || null,
        printedAt: new Date(when).toISOString()
      })
      onToast({ kind: 'success', message: 'Print event recorded.' })
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Log a print"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Record print'}
          </button>
        </>
      }
    >
      {error ? <div className="note">{error}</div> : null}

      <div className="field">
        <label htmlFor="manual-document">Document</label>
        <input
          id="manual-document"
          type="text"
          list="manual-document-options"
          value={name}
          readOnly={fileId !== null}
          placeholder="e.g. invoice-2026-10.pdf"
          onChange={(event) => setName(event.target.value)}
        />
        <datalist id="manual-document-options">
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        {fileId === null ? (
          <span className="hint">
            Matching an indexed file name links this print to that file automatically.
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="manual-printer">Printer</label>
        <input
          id="manual-printer"
          type="text"
          list="manual-printer-options"
          value={printer}
          placeholder="Optional"
          onChange={(event) => setPrinter(event.target.value)}
        />
        <datalist id="manual-printer-options">
          {printers.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
      </div>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="manual-copies">Copies</label>
          <input
            id="manual-copies"
            type="number"
            min={1}
            value={copies}
            onChange={(event) => setCopies(event.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="manual-pages">Pages</label>
          <input
            id="manual-pages"
            type="number"
            min={1}
            value={pages}
            placeholder="Optional"
            onChange={(event) => setPages(event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="manual-when">Printed at</label>
        <input
          id="manual-when"
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="manual-note">Note</label>
        <textarea
          id="manual-note"
          rows={2}
          value={note}
          placeholder="Optional"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  )
}
