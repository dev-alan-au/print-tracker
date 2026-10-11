import { useEffect, useState } from 'react'
import type { ResetOptions, ResetPreview, ToastMessage } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { applyTheme, clearCachedPreferences } from '../lib/preferences'
import Modal from './Modal'

/**
 * Wipes the local database.
 *
 * Deliberately heavy: the counts are read from the live database rather than
 * described in the abstract, the destructive confirmation is a word the user
 * has to type, and a snapshot is offered by default. A reset that loses data
 * the user did not expect to lose is unrecoverable, so the cost of making this
 * awkward is worth paying.
 */
export default function ResetDialog({
  onClose,
  onToast
}: {
  onClose: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t } = useI18n()
  const [preview, setPreview] = useState<ResetPreview | null>(null)
  const [backupFirst, setBackupFirst] = useState(true)
  const [removeBackups, setRemoveBackups] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmWord = t('settings.reset.confirmWord')
  const matches = confirmation.trim().toUpperCase() === confirmWord.toUpperCase()

  useEffect(() => {
    void (async () => {
      try {
        setPreview(await window.api.app.previewReset())
      } catch (caught) {
        onToast({ kind: 'error', message: errorMessage(caught) })
      }
    })()
  }, [onToast])

  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      const options: ResetOptions = { backupFirst, removeBackups }
      await window.api.app.reset(options)

      // The settings row is gone, so the cached theme and language would be
      // wrong on the next paint. Main reloads the window shortly.
      clearCachedPreferences()
      applyTheme('light')
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('settings.reset.title')}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy || !matches || preview === null}
            onClick={() => void run()}
          >
            {busy ? t('settings.reset.working') : t('settings.reset.confirm')}
          </button>
        </>
      }
    >
      <p>{t('settings.reset.intro')}</p>

      {preview ? (
        <dl className="kv">
          <dt>{t('settings.reset.folders')}</dt>
          <dd>{preview.counts.folders}</dd>
          <dt>{t('settings.reset.files')}</dt>
          <dd>{preview.counts.files}</dd>
          <dt>{t('settings.reset.prints')}</dt>
          <dd>{preview.counts.prints}</dd>
          <dt>{t('settings.reset.backups')}</dt>
          <dd>{preview.backups}</dd>
        </dl>
      ) : (
        <div className="note">{t('common.loading')}</div>
      )}

      <div className="note error">{t('settings.reset.warning')}</div>

      <label className="check">
        <input
          type="checkbox"
          checked={backupFirst}
          disabled={busy}
          onChange={(event) => setBackupFirst(event.target.checked)}
        />
        {t('settings.reset.backupFirst')}
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={removeBackups}
          disabled={busy || preview === null || preview.backups === 0}
          onChange={(event) => setRemoveBackups(event.target.checked)}
        />
        {t('settings.reset.removeBackups', { count: preview?.backups ?? 0 })}
      </label>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="reset-confirm">{t('settings.reset.confirmLabel', { word: confirmWord })}</label>
        <input
          id="reset-confirm"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={confirmWord}
          value={confirmation}
          disabled={busy}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
    </Modal>
  )
}
