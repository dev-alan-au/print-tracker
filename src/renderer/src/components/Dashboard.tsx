import type { DashboardStats, PrintSource } from '@shared/types'
import { formatDayLabel, formatRelative } from '../lib/format'
import SourceBadge from './SourceBadge'

const SOURCE_ORDER: PrintSource[] = ['watcher', 'spooler', 'manual']

export default function Dashboard({
  stats,
  onNavigate
}: {
  stats: DashboardStats | null
  onNavigate: (tab: 'folders' | 'files' | 'history') => void
}) {
  if (!stats) {
    return <div className="empty">Loading dashboard…</div>
  }

  const maxPerDay = Math.max(1, ...stats.printsByDay.map((entry) => entry.count))
  const totalBySource = stats.printsBySource.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Everything Print Tracker has indexed and printed so far.</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => onNavigate('folders')}>
            Manage folders
          </button>
          <button type="button" className="btn primary" onClick={() => onNavigate('history')}>
            Print history
          </button>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Folders</div>
          <div className="stat-value">{stats.folderCount}</div>
          <div className="stat-hint">being watched</div>
        </div>
        <div className="stat">
          <div className="stat-label">Files indexed</div>
          <div className="stat-value">{stats.fileCount}</div>
          <div className="stat-hint">currently present</div>
        </div>
        <div className="stat">
          <div className="stat-label">Prints recorded</div>
          <div className="stat-value">{stats.printCount}</div>
          <div className="stat-hint">all time</div>
        </div>
        <div className="stat">
          <div className="stat-label">Today</div>
          <div className="stat-value">{stats.printsToday}</div>
          <div className="stat-hint">since midnight</div>
        </div>
        <div className="stat">
          <div className="stat-label">This week</div>
          <div className="stat-value">{stats.printsThisWeek}</div>
          <div className="stat-hint">since Monday</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Prints — last 14 days</h2>
          </div>
          <div className="panel-body">
            <div className="chart">
              {stats.printsByDay.map((entry) => (
                <div
                  className="chart-col"
                  key={entry.day}
                  title={`${entry.day}: ${entry.count} print${entry.count === 1 ? '' : 's'}`}
                >
                  <div className="chart-value">{entry.count > 0 ? entry.count : ''}</div>
                  <div className="chart-bar-wrap">
                    <div
                      className={`chart-bar${entry.count === 0 ? ' empty' : ''}`}
                      style={{
                        height: `${entry.count === 0 ? 3 : Math.max(4, (entry.count / maxPerDay) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="chart-label">{formatDayLabel(entry.day)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>By detection source</h2>
          </div>
          <div className="list">
            {SOURCE_ORDER.map((source) => {
              const count = stats.printsBySource.find((entry) => entry.source === source)?.count ?? 0
              const share = totalBySource > 0 ? Math.round((count / totalBySource) * 100) : 0
              return (
                <div className="list-item" key={source}>
                  <SourceBadge source={source} />
                  <span className="grow hint">
                    {source === 'watcher'
                      ? 'Files appearing in output folders'
                      : source === 'spooler'
                        ? 'Windows print queue & event log'
                        : 'Logged by hand'}
                  </span>
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
            <h2>Most printed</h2>
          </div>
          {stats.topFiles.length === 0 ? (
            <div className="empty">
              <strong>No prints recorded yet</strong>
              Add an output folder or mark a file as printed.
            </div>
          ) : (
            <div className="list">
              {stats.topFiles.map((entry) => (
                <div className="list-item" key={`${entry.fileId ?? 'x'}-${entry.name}`}>
                  <span className="grow cell-main">{entry.name}</span>
                  <span className="count-pill">
                    {entry.count} print{entry.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
          </div>
          {stats.recent.length === 0 ? (
            <div className="empty">Nothing printed yet.</div>
          ) : (
            <div className="list">
              {stats.recent.map((event) => (
                <div className="list-item" key={event.id}>
                  <SourceBadge source={event.source} />
                  <span className="grow">
                    <div className="cell-main">{event.fileName ?? 'Unknown document'}</div>
                    <div className="cell-sub">
                      {event.printer ? `${event.printer} · ` : ''}
                      {formatRelative(event.printedAt)}
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
