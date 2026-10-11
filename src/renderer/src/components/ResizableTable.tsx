import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { ColumnWidths } from '../lib/useColumnWidths'

/**
 * A table header cell with a drag handle on its trailing edge.
 *
 * The handle is a real pointer target rather than a mousedown on the whole
 * header, so clicking a header for any other reason (or selecting its text) does
 * not start a resize. Double-clicking the handle forgets the width, which is the
 * only way back to the table deciding for itself.
 */
export function ResizableTh({
  columnKey,
  columns,
  className,
  minimum,
  children
}: {
  columnKey: string
  columns: ColumnWidths
  className?: string
  minimum?: number
  children?: ReactNode
}) {
  const { t } = useI18n()
  const handle = columns.resizeHandle(columnKey, minimum)

  return (
    <th className={className}>
      <div className="th-content">
        <span className="th-label">{children}</span>
        <span
          className="col-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('common.dragToResize')}
          title={t('common.dragToResize')}
          onPointerDown={handle.onPointerDown}
          onDoubleClick={handle.onDoubleClick}
        />
      </div>
    </th>
  )
}
