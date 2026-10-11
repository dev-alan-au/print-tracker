import { useCallback, useEffect, useState } from 'react'
import type { DashboardStats, SpoolerStatus, ToastMessage } from '@shared/types'
import Dashboard from './components/Dashboard'
import FilesPanel from './components/FilesPanel'
import FoldersPanel from './components/FoldersPanel'
import HistoryPanel from './components/HistoryPanel'
import SettingsPanel from './components/SettingsPanel'
import Toasts, { type Toast } from './components/Toasts'

type TabId = 'dashboard' | 'folders' | 'files' | 'history' | 'settings'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◆' },
  { id: 'folders', label: 'Folders', icon: '▤' },
  { id: 'files', label: 'Files', icon: '▦' },
  { id: 'history', label: 'Print history', icon: '⎙' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [refreshToken, setRefreshToken] = useState(0)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [spoolerStatus, setSpoolerStatus] = useState<SpoolerStatus | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), [])

  const addToast = useCallback((toast: ToastMessage) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, kind: toast.kind, message: toast.message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((entry) => entry.id !== id))
    }, 5200)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  /* Wired once: main-process push events drive all UI refreshes. */
  useEffect(() => {
    const offToast = window.api.events.onToast(addToast)
    const offPrint = window.api.events.onPrintRecorded((event) => {
      addToast({
        kind: 'success',
        message: `Print recorded — ${event.fileName ?? 'document'}`
      })
      refresh()
    })
    const offStatus = window.api.events.onSpoolerStatus(setSpoolerStatus)
    const offFiles = window.api.events.onFilesChanged(refresh)

    void window.api.spooler
      .status()
      .then(setSpoolerStatus)
      .catch(() => undefined)

    return () => {
      offToast()
      offPrint()
      offStatus()
      offFiles()
    }
  }, [addToast, refresh])

  useEffect(() => {
    let cancelled = false
    void window.api.prints
      .stats()
      .then((next) => {
        if (!cancelled) setStats(next)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    folders: stats?.folderCount ?? null,
    files: stats?.fileCount ?? null,
    history: stats?.printCount ?? null,
    settings: null
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⎙</div>
          <div className="brand-text">
            <strong>Print Tracker</strong>
            <span>Files &amp; print history</span>
          </div>
        </div>

        <nav className="nav">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`nav-item${tab === entry.id ? ' active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              <span className="nav-icon">{entry.icon}</span>
              {entry.label}
              {counts[entry.id] !== null ? (
                <span className="nav-count">{counts[entry.id]}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <span className={`status-dot ${spoolerStatus?.running ? 'on' : 'off'}`} />
            Spooler {spoolerStatus?.running ? 'monitoring' : 'idle'}
            {spoolerStatus && !spoolerStatus.supported ? ' (Windows only)' : ''}
          </div>
          <div>
            <span className={`status-dot ${stats ? 'on' : 'off'}`} />
            {stats ? `${stats.fileCount} files indexed` : 'Indexing…'}
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'dashboard' ? <Dashboard stats={stats} onNavigate={setTab} /> : null}
        {tab === 'folders' ? (
          <FoldersPanel refreshToken={refreshToken} onChanged={refresh} onToast={addToast} />
        ) : null}
        {tab === 'files' ? (
          <FilesPanel refreshToken={refreshToken} onChanged={refresh} onToast={addToast} />
        ) : null}
        {tab === 'history' ? (
          <HistoryPanel refreshToken={refreshToken} onChanged={refresh} onToast={addToast} />
        ) : null}
        {tab === 'settings' ? (
          <SettingsPanel
            refreshToken={refreshToken}
            spoolerStatus={spoolerStatus}
            onSpoolerStatus={setSpoolerStatus}
            onToast={addToast}
          />
        ) : null}
      </main>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
