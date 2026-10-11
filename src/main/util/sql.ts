/** Small helpers for the services that build search filters. */

/**
 * Wraps a search term in `%` for a LIKE, escaping wildcards inside it so that
 * typing a `%` or `_` looks for that character rather than matching everything.
 */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

/**
 * A `(col LIKE ? OR col LIKE ? ...)` fragment covering every column, plus the
 * parameter for each placeholder.
 *
 * The parameters are derived from the column list rather than written out
 * beside it. A `?` with no argument binds NULL in SQLite instead of raising an
 * error, so a hand-written list that falls one short leaves a filter that
 * silently matches nothing - a search box that looks broken, with nothing to
 * say why.
 */
export function likeAny(
  columns: readonly string[],
  term: string
): { sql: string; params: string[] } {
  const pattern = likePattern(term)
  const sql = `(${columns
    .map((column) => `COALESCE(${column}, '') LIKE ? ESCAPE '\\'`)
    .join('\n          OR ')})`
  return { sql, params: columns.map(() => pattern) }
}
