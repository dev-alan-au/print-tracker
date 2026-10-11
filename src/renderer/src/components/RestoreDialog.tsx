import { useCallback, useEffect, useState } from 'react'
import type { MessageKey } from '@shared/i18n'
import type { RestoreInspection, RestoreProblem, ToastMessage } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes, formatDateTime } from '../lib/format'
import { clearCachedPreferences } from '../lib/preferences'
import Modal from './Modal'

const PROBLEM_KEYS: Record<RestoreProblem, MessageKey> = {
  missing: 'settings.restore.problem.missing',
  notAFile: 'settings.restore.problem.notAFile',
  empty: 'settings.restore.problem.empty',
  notADatabase: 'settings.restore.problem.notADatabase',
  corrupt: 'settings.restore.problem.corrupt',
  missingTables: 'settings.restore.problem.missingTables',
  missingColumns: 'settings.restore.problem.missingColumns',
  newerSchema: 'settings.restore.problem.newerSchema',
  foreignKeyViolations: 'settings.restore.problem.foreignKeyViolations',
  sameFile: 'settings.restore.problem.sameFile'
}

/**
 * Restores a database snapshot.
 *
 * Nothing is written until the file has been checked and the user has seen the
 * verdict: `inspect` attaches the candidate read-only, runs SQLite's integrity
 * and foreign-key checks, and reports the row counts it found. The destructive
 * button stays disabled unless every check passed.
 */
export default function RestoreDialog({
  path,
  onClose,
  onToast
}: {
  path: string
  onClose: () => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, locale } = useI18n()
  const [inspection, setInspection] = useState<RestoreInspection | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const inspect = useCallback(async () => {
    setFailed(false)
    try {
      setInspection(await window.api.app.inspectBackup(path))
    } catch (caught) {
      setFailed(true)
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }, [path, onToast])

  useEffect(() => {
    void inspect()
  }, [inspect])

  const problemText = (problem: RestoreProblem): string => {
    if (!inspection) return problem
    return t(PROBLEM_KEYS[problem], {
      items: [...inspection.missingTables, ...inspection.missingColumns].join(', '),
      found: inspection.schemaVersion,
      supported: inspection.supportedVersion
    })
  }

  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.app.restoreBackup(path)
      // The restored settings decide the theme from here on, so the cached
      // theme would otherwise contradict them on the next paint. Main reloads
      // the window shortly.
      clearCachedPreferences()
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
      setBusy(false)
    }
  }

  const ready = inspection?.ok === true

  return (
    <Modal
      title={t('settings.restore.title')}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy || !ready}
            onClick={() => void run()}
          >
            {busy ? t('settings.restore.working') : t('settings.restore.confirm')}
          </button>
        </>
      }
    >
      <dl className="kv">
        <dt>{t('settings.restore.file')}</dt>
        <dd>
          <code>{path}</code>
        </dd>
        {inspection ? (
          <>
            <dt>{t('settings.restore.size')}</dt>
            <dd>{formatBytes(inspection.sizeBytes, locale)}</dd>
            <dt>{t('settings.restore.modified')}</dt>
            <dd>
              {inspection.modifiedAt
                ? formatDateTime(inspection.modifiedAt, locale)
                : t('common.emptyValue')}
            </dd>
            <dt>{t('settings.restore.version')}</dt>
            <dd>
              {t('settings.restore.versionValue', {
                found: inspection.schemaVersion,
                supported: inspection.supportedVersion
              })}
            </dd>
          </>
        ) : null}
      </dl>

      {failed ? <div className="note error">{t('settings.restore.checkFailed')}</div> : null}

      {!failed && inspection === null ? <div className="note">{t('common.loading')}</div> : null}

      {inspection && inspection.ok ? (
        <>
          <div className="note">{t('settings.restore.okIntro')}</div>
          <dl className="kv">
            <dt>{t('settings.reset.folders')}</dt>
            <dd>{inspection.counts.folders}</dd>
            <dt>{t('settings.reset.files')}</dt>
            <dd>{inspection.counts.files}</dd>
            <dt>{t('settings.reset.prints')}</dt>
            <dd>{inspection.counts.prints}</dd>
          </dl>
        </>
      ) : null}

      {inspection && !inspection.ok ? (
        <>
          <div className="note error">
            <strong>{t('settings.restore.blockedTitle')}</strong>
            <ul className="problem-list">
              {inspection.problems.map((problem) => (
                <li key={problem}>{problemText(problem)}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {ready ? <div className="note">{t('settings.restore.undo')}</div> : null}
    </Modal>
  )
}
