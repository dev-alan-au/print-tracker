import { useCallback, useEffect, useMemo, useState } from 'react'
import { type AppLanguage, type Locale, type MessageKey, LOCALES, LOCALE_LABELS, resolveLocale } from '@shared/i18n'
import type {
  AppSettings,
  AppTheme,
  DashboardStats,
  SpoolerStatus,
  ToastMessage
} from '@shared/types'
import Dashboard from './components/Dashboard'
import FilesPanel from './components/FilesPanel'
import FoldersPanel from './components/FoldersPanel'
import HistoryPanel from './components/HistoryPanel'
import OverviewPanel from './components/OverviewPanel'
import SettingsPanel from './components/SettingsPanel'
import Toasts, { type Toast } from './components/Toasts'
import { I18nProvider, createI18n } from './i18n'
import {
  applyTheme,
  readCachedLanguage,
  readCachedTheme,
  writeCachedLanguage,
  writeCachedTheme
} from './lib/preferences'

type TabId = 'overview' | 'dashboard' | 'folders' | 'files' | 'history' | 'settings'

const TABS: { id: TabId; labelKey: MessageKey; icon: string }[] = [
  { id: 'overview', labelKey: 'nav.overview', icon: '◉' },
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: '◆' },
  { id: 'folders', labelKey: 'nav.folders', icon: '▤' },
  { id: 'files', labelKey: 'nav.files', icon: '▦' },
  { id: 'history', labelKey: 'nav.history', icon: '⎙' },
  { id: 'settings', labelKey: 'nav.settings', icon: '⚙' }
]

export default function App() {
  const [tab, setTab] = useState<TabId>('overview')
  const [refreshToken, setRefreshToken] = useState(0)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [spoolerStatus, setSpoolerStatus] = useState<SpoolerStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [language, setLanguage] = useState<AppLanguage>(readCachedLanguage)
  const [theme, setTheme] = useState<AppTheme>(() => readCachedTheme() ?? 'light')
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), [])

  const locale: Locale = useMemo(
    () => resolveLocale(language, typeof navigator === 'undefined' ? 'en' : navigator.language),
    [language]
  )
  const i18n = useMemo(() => createI18n(locale), [locale])

  // Keep the document language in sync so the browser applies the right fonts.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // Keep the colour scheme in sync with the stored setting.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const applySettings = useCallback((next: AppSettings) => {
    setSettings(next)
    setLanguage(next.language)
    writeCachedLanguage(next.language)
    setTheme(next.theme)
    writeCachedTheme(next.theme)
  }, [])

  useEffect(() => {
    void window.api.settings
      .get()
      .then(applySettings)
      .catch(() => undefined)
  }, [applySettings])

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await window.api.settings.update(patch)
      applySettings(next)
      return next
    },
    [applySettings]
  )

  const addToast = useCallback(
    (toast: ToastMessage) => {
      // Main-process toasts arrive as keys; technical errors arrive as text.
      const text = toast.messageKey
        ? i18n.t(toast.messageKey, toast.messageParams)
        : (toast.message ?? '')
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev.slice(-3), { id, kind: toast.kind, message: text }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((entry) => entry.id !== id))
      }, 5200)
    },
    [i18n]
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  /* Wired once: main-process push events drive all UI refreshes. */
  useEffect(() => {
    const offToast = window.api.events.onToast(addToast)
    const offPrint = window.api.events.onPrintRecorded((event) => {
      addToast({
        kind: 'success',
        messageKey: 'toast.printRecorded',
        messageParams: { name: event.fileName ?? i18n.t('common.unknownDocument') }
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
  }, [addToast, refresh, i18n])

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
    overview: null,
    dashboard: null,
    folders: stats?.folderCount ?? null,
    files: stats?.fileCount ?? null,
    history: stats?.printCount ?? null,
    settings: null
  }

  const shell = (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⎙</div>
          <div className="brand-text">
            <strong>Print Tracker</strong>
            <span>{i18n.t('app.subtitle')}</span>
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
              {i18n.t(entry.labelKey)}
              {counts[entry.id] !== null ? (
                <span className="nav-count">{counts[entry.id]}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <select
            className="lang-switch"
            aria-label={i18n.t('settings.appearance.language')}
            value={language}
            onChange={(event) =>
              void updateSettings({ language: event.target.value as AppLanguage })
            }
          >
            <option value="system">{i18n.t('settings.appearance.system')}</option>
            {LOCALES.map((entry) => (
              <option key={entry} value={entry}>
                {LOCALE_LABELS[entry]}
              </option>
            ))}
          </select>

          <div>
            <span className={`status-dot ${spoolerStatus?.running ? 'on' : 'off'}`} />
            {spoolerStatus?.running
              ? i18n.t('sidebar.spoolerMonitoring')
              : i18n.t('sidebar.spoolerIdle')}
            {spoolerStatus && !spoolerStatus.supported
              ? ` ${i18n.t('sidebar.windowsOnly')}`
              : ''}
          </div>
          <div>
            <span className={`status-dot ${stats ? 'on' : 'off'}`} />
            {stats
              ? i18n.t('sidebar.filesIndexed', { count: stats.fileCount })
              : i18n.t('sidebar.indexing')}
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'overview' ? (
          <OverviewPanel refreshToken={refreshToken} onToast={addToast} />
        ) : null}
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
            settings={settings}
            onUpdateSettings={updateSettings}
            spoolerStatus={spoolerStatus}
            onSpoolerStatus={setSpoolerStatus}
            onToast={addToast}
          />
        ) : null}
      </main>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )

  return <I18nProvider locale={locale}>{shell}</I18nProvider>
}
