import type { PrintSource } from '@shared/types'

const LABELS: Record<PrintSource, string> = {
  watcher: 'Folder watch',
  spooler: 'Spooler',
  manual: 'Manual'
}

export default function SourceBadge({ source }: { source: PrintSource }) {
  return <span className={`badge ${source}`}>{LABELS[source] ?? source}</span>
}
