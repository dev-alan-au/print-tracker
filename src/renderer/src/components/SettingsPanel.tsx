import { useCallback, useEffect, useState } from 'react'
import type { AppInfo, AppSettings, SpoolerStatus, ToastMessage } from '@shared/types'
import { errorMessage, formatDateTime, formatRelative } from '../lib/format'

export default function SettingsPanel({
  refreshToken,
  spoolerStatus,
  onSpoolerStatus,
  onToast
}: {
  refreshToken: number
  spoolerStatus: SpoolerStatus | null
  onSpoolerStatus: (status: SpoolerStatus) => void
  onToast: (toast: ToastMessage) => void
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [printers, setPrinters] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextInfo, status] = await Promise.all([
        window.api.settings.get(),
        window.api.settings.appInfo(),
        window.api.spooler.status()
      ])
      setSettings(nextSettings)
      setInfo(nextInfo)
      onSpoolerStatus(status)
    } catch (caught) {
      onToast({ kind: 'error', message: errorMessage(caught) })
    }
  }, [onSpoolerStatus, onToast, refreshToken])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (changes: Partial<AppSettings>): Promise<void> => {
    try {
      setSettings(await window.api.settings.update(changes))
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

  const copyDatabasePath = async (): Promise<void> => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.databasePath)
      onToast({ kind: 'success', message: 'Database path copied.' })
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
          <h1>Settings</h1>
          <p>Detection sources, polling behaviour and application information.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Windows print spooler</h2>
          <span className="spacer" />
          <span className="badge neutral">
            <span className={`status-dot ${statusDotClass}`} />
            {spoolerStatus?.running ? 'running' : 'stopped'}
          </span>
        </div>

        <div className="panel-body">
          {spoolerStatus && !spoolerStatus.supported ? (
            <div className="note">
              Spooler monitoring only works on Windows. On this platform Print Tracker still tracks
              files inside watched folders and accepts manual print entries.
            </div>
          ) : null}

          {spoolerStatus?.lastError ? <div className="note">{spoolerStatus.lastError}</div> : null}

          <div className="row">
            <button
              type="button"
              className={spoolerStatus?.running ? 'btn' : 'btn primary'}
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void toggleSpooler()}
            >
              {spoolerStatus?.running ? 'Stop monitoring' : 'Start monitoring'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void pollNow()}
            >
              Poll now
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !spoolerStatus?.supported}
              onClick={() => void refreshPrinters()}
            >
              List printers
            </button>
          </div>

          <div className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 220, marginBottom: 0 }}>
              <label htmlFor="poll-interval">Poll interval (seconds)</label>
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
              start monitoring with the app
            </label>
          </div>

          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Event log enabled</dt>
            <dd>
              {spoolerStatus?.logEnabled === null || spoolerStatus === null
                ? 'unknown'
                : spoolerStatus.logEnabled
                  ? 'yes — reading Microsoft-Windows-PrintService/Operational'
                  : 'no — falling back to print-queue tracking'}
            </dd>
            <dt>Last poll</dt>
            <dd>{spoolerStatus?.lastPollAt ? formatDateTime(spoolerStatus.lastPollAt) : 'never'}</dd>
            <dt>Printers detected</dt>
            <dd>
              {(printers.length > 0 ? printers : spoolerStatus?.printers ?? []).join(', ') || '—'}
            </dd>
          </dl>

          {spoolerStatus?.supported && spoolerStatus.logEnabled === false ? (
            <div className="note">
              The operational print log is disabled, so completed jobs are inferred from the print
              queue. For exact page counts and document names, enable it once from an{' '}
              <strong>elevated PowerShell</strong>:
              <br />
              <code>wevtutil sl Microsoft-Windows-PrintService/Operational /e:true</code>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Folder watching</h2>
        </div>
        <div className="panel-body">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="check" style={{ paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={settings?.autoStartWatching ?? true}
                onChange={(event) => void patch({ autoStartWatching: event.target.checked })}
              />
              watch folders while the app is running
            </label>

            <div className="field" style={{ width: 240, marginBottom: 0 }}>
              <label htmlFor="stability">Wait for writes to settle (ms)</label>
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

          <div className="note">
            A file in an <strong>output</strong> folder counts as a print once it has been stable for
            this long. Increase it if your print workflow writes files in several passes.
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>About</h2>
        </div>
        <div className="panel-body">
          <dl className="kv">
            <dt>Application</dt>
            <dd>
              {info?.name ?? 'Print Tracker'} {info?.version ? `v${info.version}` : ''}
            </dd>
            <dt>Platform</dt>
            <dd>{info?.platform ?? '—'}</dd>
            <dt>Electron / Node / Chromium</dt>
            <dd>
              {info ? `${info.electron} / ${info.node} / ${info.chrome}` : '—'}
            </dd>
            <dt>Data directory</dt>
            <dd>{info?.dataDir ?? '—'}</dd>
            <dt>Database</dt>
            <dd>
              <code>{info?.databasePath ?? '—'}</code>{' '}
              <button type="button" className="btn tiny ghost" onClick={() => void copyDatabasePath()}>
                copy
              </button>
            </dd>
            <dt>Session uptime</dt>
            <dd>{formatRelative(new Date(Date.now() - performance.now()).toISOString())}</dd>
          </dl>
        </div>
      </section>
    </>
  )
}
