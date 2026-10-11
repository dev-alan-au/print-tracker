import { useState } from 'react'
import { FILE_NOTES_MAX_LENGTH } from '@shared/types'
import type { ToastMessage, TrackedFile } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import Modal from './Modal'

/**
 * A short note about a file.
 *
 * The counter is not decoration: the limit is enforced again in the main
 * process, so without it a long paste would appear to be accepted and then come
 * back silently truncated.
 */
export default function NotesDialog({
  file,
  onClose,
  onSaved,
  onToast
}: {
  file: TrackedFile
  onClose: () => void
  onSaved: (updated: TrackedFile) => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t } = useI18n()
  const [notes, setNotes] = useState(file.notes ?? '')
  const [busy, setBusy] = useState(false)

  const used = notes.length
  const atLimit = used >= FILE_NOTES_MAX_LENGTH

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const updated = await window.api.files.setNotes(file.id, notes)
      onSaved(updated)
      onToast({
        kind: 'success',
        messageKey: updated.notes ? 'files.notes.saved' : 'files.notes.cleared',
        messageParams: { name: file.name }
      })
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('files.notes.title')}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="cell-main">{file.name}</p>
      <p className="cell-sub notes-path" title={file.path}>
        {file.relativePath}
      </p>

      <div className="field">
        <label htmlFor="file-notes">{t('files.notes.label')}</label>
        <textarea
          id="file-notes"
          rows={4}
          // maxLength stops the counter ever reading over the limit, and the
          // server-side cap is the one that actually enforces it.
          maxLength={FILE_NOTES_MAX_LENGTH}
          placeholder={t('files.notes.placeholder')}
          value={notes}
          disabled={busy}
          onChange={(event) => setNotes(event.target.value)}
        />
        <div className={`notes-counter${atLimit ? ' at-limit' : ''}`}>
          {t('files.notes.counter', { used, max: FILE_NOTES_MAX_LENGTH })}
        </div>
      </div>
    </Modal>
  )
}
