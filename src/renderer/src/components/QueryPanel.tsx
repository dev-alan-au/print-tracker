import { useCallback, useEffect, useState } from 'react'
import type { QueryResult, SchemaTable, ToastMessage } from '@shared/types'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'

/** Mirrors the guard in the main process, so the message can be translated. */
const READ_ONLY_PATTERN = /^\s*(select|with|explain|pragma|values)\b/i

const STARTER_SQL = `SELECT name, printed_count, last_printed_at
FROM files
ORDER BY last_printed_at DESC
LIMIT 50;`

function ResultView({ result }: { result: QueryResult }) {
  const { t } = useI18n()

  if (result.columns.length === 0) {
    return (
      <p className="hint">
        {result.changes === null
          ? t('query.result.executed')
          : t('query.result.changes', { count: result.changes })}
      </p>
    )
  }

  return (
    <>
      <p className="hint">{t('query.result.rows', { count: result.rows.length })}</p>
      <div className="query-result">
        <table>
          <thead>
            <tr>
              {result.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index}>
                {result.columns.map((column) => (
                  <td key={column}>
                    {row[column] === null ? (
                      <span className="hint">{t('common.emptyValue')}</span>
                    ) : (
                      String(row[column])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * A SQL console over the live database. The schema browser doubles as the way
 * to start a query: clicking a table drops a SELECT for it into the editor.
 */
export default function QueryPanel({
  onToast
}: {
  onToast: (toast: ToastMessage) => void
}) {
  const { t } = useI18n()
  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [sql, setSql] = useState(STARTER_SQL)
  const [readOnly, setReadOnly] = useState(true)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.query
      .schema()
      .then(setSchema)
      .catch((caught: unknown) => onToast({ kind: 'error', message: errorMessage(caught) }))
  }, [onToast])

  const run = useCallback(async () => {
    if (readOnly && !READ_ONLY_PATTERN.test(sql.trim())) {
      setResult(null)
      setError(t('query.error.readOnly'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      setResult(await window.api.query.run(sql, readOnly))
    } catch (caught) {
      setResult(null)
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }, [sql, readOnly, t])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('query.title')}</h1>
          <p>{t('query.subtitle')}</p>
        </div>
        <div className="row">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
            {t('query.run')}
          </button>
        </div>
      </header>

      <div className="query-layout">
        <aside className="panel">
          <div className="panel-head">
            <h2>{t('query.schema.title')}</h2>
          </div>
          <div className="list list-scroll">
            {schema.map((table) => (
              <div className="query-table" key={table.name}>
                <button
                  type="button"
                  className="btn ghost query-table-name"
                  title={t('query.schema.title')}
                  onClick={() => setSql(`SELECT * FROM "${table.name}" LIMIT 100;`)}
                >
                  {table.name}
                </button>
                <ul className="query-columns">
                  {table.columns.map((column) => (
                    <li key={column.name}>
                      <span className="query-column-name">{column.name}</span>
                      <span className="query-column-type">{column.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="panel-head">
            <label className="check">
              <input
                type="checkbox"
                checked={readOnly}
                onChange={(event) => setReadOnly(event.target.checked)}
              />
              {t('query.readOnly')}
            </label>
            <span className="spacer" />
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
              {t('query.run')}
            </button>
          </div>

          <div className="panel-body">
            <textarea
              className="query-editor"
              spellCheck={false}
              value={sql}
              placeholder={t('query.editor.placeholder')}
              onChange={(event) => setSql(event.target.value)}
              onKeyDown={(event) => {
                // Ctrl/Cmd + Enter runs, as in every other SQL console.
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
            />

            <p className="hint" style={{ marginTop: 8 }}>
              {readOnly ? t('query.readOnlyHint') : t('query.writeHint')}
            </p>

            {error ? (
              <div className="note error">
                <strong>{t('query.error.title')}</strong>
                <div>{error}</div>
              </div>
            ) : null}

            {result ? <ResultView result={result} /> : null}
          </div>
        </section>
      </div>
    </>
  )
}
