import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

/**
 * Column widths for a table, dragged by the user and remembered per table.
 *
 * Widths live in `localStorage` rather than the database: they describe this
 * window on this screen, so they should not travel with a backup.
 */
export interface ColumnWidths {
  /** Widths in pixels, keyed by column. Empty until the user resizes. */
  widths: Record<string, number>
  /** Attach to a header cell to make it resizable. Omit to leave it fixed. */
  resizeHandle: (key: string, minimum?: number) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onDoubleClick: () => void
  }
  /** True while a drag is in progress, for suppressing text selection. */
  dragging: boolean
}

const STORAGE_PREFIX = 'print-tracker.columns.'
const MAX_WIDTH = 1200

function read(tableId: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const widths: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const width = Number(value)
      if (Number.isFinite(width) && width > 0) widths[key] = Math.round(width)
    }
    return widths
  } catch {
    return {}
  }
}

/**
 * @param tableId     Namespace for the stored widths.
 * @param columnKeys  Every resizable column, in header order. They are needed
 *   because pinning one width forces the table into fixed layout, and the
 *   remaining columns would all collapse to equal widths the moment anything is
 *   dragged. Measuring them first keeps the untouched columns where they were.
 */
export function useColumnWidths(tableId: string, columnKeys: string[]): ColumnWidths {
  const [widths, setWidths] = useState<Record<string, number>>(() => read(tableId))
  const [dragging, setDragging] = useState(false)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    setWidths(read(tableId))
  }, [tableId])

  const persist = useCallback(
    (next: Record<string, number>) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(next))
      } catch {
        /* storage unavailable; the widths still apply for this session */
      }
    },
    [tableId]
  )

  /** Current on-screen width of every column, in header order. */
  const measure = useCallback(
    (handle: HTMLElement): Record<string, number> => {
      const cells = handle.closest('table')?.querySelectorAll('thead th')
      const measured: Record<string, number> = {}
      if (!cells) return measured
      columnKeys.forEach((key, index) => {
        const cell = cells[index]
        if (cell) measured[key] = Math.round(cell.getBoundingClientRect().width)
      })
      return measured
    },
    [columnKeys]
  )

  const resizeHandle = useCallback(
    (key: string, minimum = 60) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        // Without this the drag selects the header text instead of resizing.
        event.preventDefault()
        event.stopPropagation()

        const handle = event.currentTarget
        // Already-stored widths win over freshly measured ones, so dragging a
        // column that has been resized before continues from where it was left.
        const base = { ...measure(handle), ...widths }
        const startWidth = base[key]
        if (startWidth === undefined) return

        const startX = event.clientX
        // Tracked outside React so the final position is never lost to a frame
        // that had not run yet.
        let latest = Math.round(startWidth)

        try {
          handle.setPointerCapture(event.pointerId)
        } catch {
          // Capture is a convenience; the listeners below are on the element
          // itself, so a drag still works without it.
        }
        setDragging(true)

        const move = (moveEvent: PointerEvent): void => {
          latest = Math.min(
            MAX_WIDTH,
            Math.max(minimum, Math.round(startWidth + (moveEvent.clientX - startX)))
          )
          // Coalesced to one update per frame: pointermove fires far faster than
          // the table can usefully re-render, and only the last one matters.
          if (frame.current !== null) return
          frame.current = requestAnimationFrame(() => {
            frame.current = null
            const value = latest
            setWidths({ ...base, [key]: value })
          })
        }

        const finish = (): void => {
          if (frame.current !== null) {
            cancelAnimationFrame(frame.current)
            frame.current = null
          }
          try {
            handle.releasePointerCapture(event.pointerId)
          } catch {
            /* never captured */
          }
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', finish)
          handle.removeEventListener('pointercancel', finish)
          setDragging(false)

          const next = { ...base, [key]: latest }
          setWidths(next)
          persist(next)
        }

        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', finish)
        handle.addEventListener('pointercancel', finish)
      },

      /** Double click forgets this column, the only way back to the default. */
      onDoubleClick: () => {
        setWidths((current) => {
          const next = { ...current }
          delete next[key]
          persist(next)
          return next
        })
      }
    }),
    [measure, persist, widths]
  )

  return { widths, resizeHandle, dragging }
}
