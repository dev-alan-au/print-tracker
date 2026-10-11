import { useCallback, useEffect, useState } from 'react'
import { LOCALE_LABELS, LOCALES, type AppLanguage } from '@shared/i18n'
import type {
  AppInfo,
  AppSettings,
  AppTheme,
  BackupEntry,
  SpoolerStatus,
  ToastMessage
} from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes, formatDateTime, formatRelative } from '../lib/format'
import PageHelp from './PageHelp'
import ResetDialog from './ResetDialog'
import RestoreDialog from './RestoreDialog'

export default function SettingsPanel({
  refreshToken,
  settings,
  onUpdateSettings,
  spoolerStatus,
  onSpoolerStatus,
  onToast
}: {
  refreshToken: number
  settings: AppSettings | null
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  spoolerStatus: SpoolerStatus | null
  onSpoolerStatus: (status: SpoolerStatus) => void
  onToast: (toast: ToastMessage) => void
}) {
  const { t, locale } = useI18n()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [printers, setPrinters] = useState<string[]>([])
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  /** Path of the snapshot being restored, chosen from a row or from disk. */
  const [restorePath, setRestorePath] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextInfo, status, nextBackups] = await Promise.all([
        window.api.settings.appInfo(),
        window.api.spooler.status(),
        window.api.backups.list()
      ])
      setInfo(nextInfo)
      onSpoolerStatus(status)
      setBackups(nextBackups)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }, [onSpoolerStatus, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (changes: Partial<AppSettings>): Promise<void> => {
    try {
      await onUpdateSettings(changes)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  const toggleSpooler = async (): Promise<void> => {
    if (!spoolerStatus) return
    setBusy(true)
    try {
      const next = spoolerStatus.running
        ? await window.api.spooler.stop()
        : await window.api.spooler.start()
      onSpoolerStatus(next)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }

  const pollNow = async (): Promise<void> => {
    setBusy(true)
    try {
      onSpoolerStatus(await window.api.spooler.pollNow())
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }

  const refreshPrinters = async (): Promise<void> => {
    setBusy(true)
    try {
      setPrinters(await window.api.spooler.listPrinters())
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }

  const createBackup = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.backups.create()
      onToast({ kind: 'success', messageKey: 'settings.backups.created' })
      setBackups(await window.api.backups.list())
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }

  const removeBackup = async (entry: BackupEntry): Promise<void> => {
    if (!window.confirm(t('settings.backups.confirmRemove', { name: entry.name }))) return
    try {
      await window.api.backups.remove(entry.path)
      onToast({ kind: 'info', messageKey: 'settings.backups.removed' })
      setBackups(await window.api.backups.list())
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  const pickBackupFile = async (): Promise<void> => {
    try {
      const chosen = await window.api.app.pickBackupFile()
      if (chosen) setRestorePath(chosen)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }

  const copyDatabasePath = async (): Promise<void> => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.databasePath)
      onToast({ kind: 'success', messageKey: 'settings.toast.copied' })
    } catch {
      onToast({ kind: 'warning', message: info.databasePath })
    }
  }

  const statusDotClass = !spoolerStatus
    ? 'off'
    : !spoolerStatus.supported
      ? 'off'
      : spoolerStatus.lastError
        ? 'error'
        : spoolerStatus.running
          ? 'on'
          : 'off'

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
          <PageHelp page="settings" />
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('settings.appearance.title')}</h2>
        </div>
        <div className="panel-body">
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="language">{t('settings.appearance.language')}</label>
            <select
              id="language"
              value={settings?.language ?? 'system'}
              onChange={(event) => void patch({ language: event.target.value as AppLanguage })}
            >
              <option value="system">{t('settings.appearance.system')}</option>
              {LOCALES.map((entry) => (
                <option key={entry} value={entry}>
                  {LOCALE_LABELS[entry]}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="theme">{t('settings.appearance.theme')}</label>
            <select
              id="theme"
              value={settings?.theme ?? 'light'}
              onChange={(event) => void patch({ theme: event.target.value as AppTheme })}
            >
              <option value="light">{t('settings.appearance.themeLight')}</option>
              <option value="dark">{t('settings.appearance.themeDark')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('settings.spooler.title')}</h2>
          <span className="spacer" />
          <span className="badge neutral">
            <span className={`status-dot ${statusDotClass}`} />
            {spoolerStatus?.running ? t('settings.spooler.running') : t('settings.spooler.stopped')}
          </span>
        </div>

        <div className="panel-body">
          {spoolerStatus && !spoolerStatus.supported ? (
            <div className="note">{t('settings.spooler.unsupported')}</div>
          ) : null}

          {/* On an unsupported platform the note above already says everything,
              and the raw error would only repeat it in untranslated English. */}
          {spoolerStatus?.supported && spoolerStatus.lastError ? (
            <div className="note">{spoolerStatus.lastError}</div>
          ) : null}

          <div className="row">
            <button
              type="button"
              className={spoolerStatus?.running ? 'btn' : 'btn primary'}
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void toggleSpooler()}
            >
              {spoolerStatus?.running
                ? t('settings.spooler.stop')
                : t('settings.spooler.start')}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void pollNow()}
            >
              {t('settings.spooler.pollNow')}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void refreshPrinters()}
            >
              {t('settings.spooler.listPrinters')}
            </button>
          </div>

          <div className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 220, marginBottom: 0 }}>
              <label htmlFor="poll-interval">{t('settings.spooler.pollInterval')}</label>
              <input
                id="poll-interval"
                type="number"
                min={2}
                value={Math.round((settings?.spoolerPollIntervalMs ?? 5000) / 1000)}
                onChange={(event) =>
                  void patch({
                    spoolerPollIntervalMs: Math.max(2, Number(event.target.value) || 5) * 1000
                  })
                }
              />
            </div>
            <label className="check" style={{ paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={settings?.spoolerEnabled ?? true}
                onChange={(event) => void patch({ spoolerEnabled: event.target.checked })}
              />
              {t('settings.spooler.autoStart')}
            </label>
          </div>

          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>{t('settings.spooler.eventLog')}</dt>
            <dd>
              {spoolerStatus?.logEnabled === null || spoolerStatus === null
                ? t('settings.spooler.eventLogUnknown')
                : spoolerStatus.logEnabled
                  ? t('settings.spooler.eventLogEnabled')
                  : t('settings.spooler.eventLogDisabled')}
            </dd>
            <dt>{t('settings.spooler.lastPoll')}</dt>
            <dd>
              {spoolerStatus?.lastPollAt
                ? formatDateTime(spoolerStatus.lastPollAt, locale)
                : t('settings.spooler.never')}
            </dd>
            <dt>{t('settings.spooler.printers')}</dt>
            <dd>
              {(printers.length > 0 ? printers : (spoolerStatus?.printers ?? [])).join(', ') ||
                t('common.emptyValue')}
            </dd>
          </dl>

          {spoolerStatus?.supported && spoolerStatus.logEnabled === false ? (
            <div className="note">
              {t('settings.spooler.enableLog')}
              <br />
              <code>wevtutil sl Microsoft-Windows-PrintService/Operational /e:true</code>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('settings.backups.title')}</h2>
          <span className="spacer" />
          <button type="button" className="btn" disabled={busy} onClick={() => void pickBackupFile()}>
            {t('settings.backups.restoreFromFile')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void createBackup()}>
            {t('settings.backups.create')}
          </button>
        </div>
        <div className="panel-body flush">
          <p className="panel-note">{t('settings.backups.description')}</p>
          {backups.length === 0 ? (
            <div className="empty">{t('settings.backups.empty')}</div>
          ) : (
            <div className="list">
              {backups.map((entry) => (
                <div className="list-item" key={entry.path}>
                  <span className="grow">
                    <div className="cell-main">{entry.name}</div>
                    <div className="cell-sub">
                      {formatDateTime(entry.createdAt, locale)} ·{' '}
                      {formatBytes(entry.size, locale)}
                    </div>
                  </span>
                  <button
                    type="button"
                    className="btn tiny"
                    disabled={busy}
                    onClick={() => setRestorePath(entry.path)}
                  >
                    {t('settings.backups.restore')}
                  </button>
                  <button
                    type="button"
                    className="btn tiny danger"
                    onClick={() => void removeBackup(entry)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('settings.watching.title')}</h2>
        </div>
        <div className="panel-body">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="check" style={{ paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={settings?.autoStartWatching ?? true}
                onChange={(event) => void patch({ autoStartWatching: event.target.checked })}
              />
              {t('settings.watching.autoStart')}
            </label>

            <div className="field" style={{ width: 240, marginBottom: 0 }}>
              <label htmlFor="stability">{t('settings.watching.stability')}</label>
              <input
                id="stability"
                type="number"
                min={200}
                step={100}
                value={settings?.minFileStabilityMs ?? 1500}
                onChange={(event) =>
                  void patch({ minFileStabilityMs: Math.max(200, Number(event.target.value) || 1500) })
                }
              />
            </div>
          </div>

          <div className="note">{t('settings.watching.note')}</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('settings.about.title')}</h2>
        </div>
        <div className="panel-body">
          <dl className="kv">
            <dt>{t('settings.about.application')}</dt>
            <dd>
              {info?.name ?? 'Print Tracker'} {info?.version ? `v${info.version}` : ''}
            </dd>
            <dt>{t('settings.about.platform')}</dt>
            <dd>{info?.platform ?? t('common.emptyValue')}</dd>
            <dt>{t('settings.about.runtime')}</dt>
            <dd>{info ? `${info.electron} / ${info.node} / ${info.chrome}` : t('common.emptyValue')}</dd>
            <dt>{t('settings.about.dataDir')}</dt>
            <dd>{info?.dataDir ?? t('common.emptyValue')}</dd>
            <dt>{t('settings.about.database')}</dt>
            <dd>
              <code>{info?.databasePath ?? t('common.emptyValue')}</code>{' '}
              <button type="button" className="btn tiny ghost" onClick={() => void copyDatabasePath()}>
                {t('common.copy')}
              </button>
            </dd>
            <dt>{t('settings.about.sessionUptime')}</dt>
            <dd>
              {formatRelative(new Date(Date.now() - performance.now()).toISOString(), locale)}
            </dd>
          </dl>
        </div>
      </section>

      <section className="panel danger-zone">
        <div className="panel-head">
          <h2>{t('settings.reset.danger')}</h2>
        </div>
        <div className="panel-body">
          <p className="panel-note">{t('settings.reset.description')}</p>
          <button type="button" className="btn danger" onClick={() => setResetOpen(true)}>
            {t('settings.reset.open')}
          </button>
        </div>
      </section>

      {resetOpen ? (
        <ResetDialog onClose={() => setResetOpen(false)} onToast={onToast} />
      ) : null}

      {restorePath ? (
        <RestoreDialog
          path={restorePath}
          onClose={() => setRestorePath(null)}
          onToast={onToast}
        />
      ) : null}
    </>
  )
}
