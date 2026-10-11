import type { DashboardStats, MessageKey, PrintSource } from '@shared/types'
import { useI18n } from '../i18n'
import { formatDayLabel, formatRelative } from '../lib/format'
import SourceBadge from './SourceBadge'

const SOURCE_ORDER: PrintSource[] = ['watcher', 'spooler', 'manual']

/**
 * Plot height in pixels. Bar heights are computed from this, so the chart does
 * not depend on CSS percentage resolution inside a flex column - which proved
 * unreliable here and made every bar stretch to fill its column.
 */
const PLOT_HEIGHT = 84

const SOURCE_DESCRIPTION_KEYS: Record<PrintSource, MessageKey> = {
  watcher: 'dashboard.sources.watcher',
  spooler: 'dashboard.sources.spooler',
  manual: 'dashboard.sources.manual'
}

export default function Dashboard({
  stats,
  onNavigate
}: {
  stats: DashboardStats | null
  onNavigate: (tab: 'folders' | 'files' | 'history') => void
}) {
  const { t, tn, locale } = useI18n()

  if (!stats) {
    return <div className="empty">{t('dashboard.loading')}</div>
  }

  const maxPerDay = Math.max(1, ...stats.printsByDay.map((entry) => entry.count))
  const totalBySource = stats.printsBySource.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => onNavigate('folders')}>
            {t('dashboard.manageFolders')}
          </button>
          <button type="button" className="btn primary" onClick={() => onNavigate('history')}>
            {t('dashboard.printHistory')}
          </button>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">{t('dashboard.stat.folders')}</div>
          <div className="stat-value">{stats.folderCount}</div>
          <div className="stat-hint">{t('dashboard.hint.watched')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('dashboard.stat.files')}</div>
          <div className="stat-value">{stats.fileCount}</div>
          <div className="stat-hint">{t('dashboard.hint.present')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('dashboard.stat.prints')}</div>
          <div className="stat-value">{stats.printCount}</div>
          <div className="stat-hint">{t('dashboard.hint.allTime')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('dashboard.stat.today')}</div>
          <div className="stat-value">{stats.printsToday}</div>
          <div className="stat-hint">{t('dashboard.hint.sinceMidnight')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('dashboard.stat.week')}</div>
          <div className="stat-value">{stats.printsThisWeek}</div>
          <div className="stat-hint">{t('dashboard.hint.sinceMonday')}</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.chart.title')}</h2>
          </div>
          <div className="panel-body">
            <div className="chart">
              {stats.printsByDay.map((entry) => (
                <div
                  className="chart-col"
                  key={entry.day}
                  title={t('dashboard.chart.tooltip', {
                    day: formatDayLabel(entry.day, locale),
                    count: entry.count
                  })}
                >
                  <div className="chart-value">{entry.count > 0 ? entry.count : ''}</div>
                  <div className="chart-bar-wrap" style={{ height: PLOT_HEIGHT }}>
                    <div
                      className={`chart-bar${entry.count === 0 ? ' is-empty' : ''}`}
                      style={{
                        height: Math.max(3, Math.round((entry.count / maxPerDay) * PLOT_HEIGHT))
                      }}
                    />
                  </div>
                  <div className="chart-label">{formatDayLabel(entry.day, locale)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.sources.title')}</h2>
          </div>
          <div className="list">
            {SOURCE_ORDER.map((source) => {
              const count = stats.printsBySource.find((entry) => entry.source === source)?.count ?? 0
              const share = totalBySource > 0 ? Math.round((count / totalBySource) * 100) : 0
              return (
                <div className="list-item" key={source}>
                  <SourceBadge source={source} />
                  <span className="grow hint">{t(SOURCE_DESCRIPTION_KEYS[source])}</span>
                  <span className="count-pill">
                    {count} · {share}%
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.top.title')}</h2>
          </div>
          {stats.topFiles.length === 0 ? (
            <div className="empty">
              <strong>{t('dashboard.top.emptyTitle')}</strong>
              {t('dashboard.top.emptyBody')}
            </div>
          ) : (
            <div className="list">
              {stats.topFiles.map((entry) => (
                <div className="list-item" key={`${entry.fileId ?? 'x'}-${entry.name}`}>
                  <span className="grow cell-main">{entry.name}</span>
                  <span className="count-pill">
                    {tn(entry.count, 'unit.prints.one', 'unit.prints.other')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.recent.title')}</h2>
          </div>
          {stats.recent.length === 0 ? (
            <div className="empty">{t('dashboard.recent.empty')}</div>
          ) : (
            <div className="list">
              {stats.recent.map((event) => (
                <div className="list-item" key={event.id}>
                  <SourceBadge source={event.source} />
                  <span className="grow">
                    <div className="cell-main">
                      {event.fileName ?? t('common.unknownDocument')}
                    </div>
                    <div className="cell-sub">
                      {event.printer ? `${event.printer} · ` : ''}
                      {formatRelative(event.printedAt, locale)}
                    </div>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
