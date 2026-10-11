import type { PrintSource } from '@shared/types'
import { useI18n } from '../i18n'

const KEYS = {
  watcher: 'source.watcher',
  spooler: 'source.spooler',
  manual: 'source.manual'
} as const

export default function SourceBadge({ source }: { source: PrintSource }) {
  const { t } = useI18n()
  return <span className={`badge ${source}`}>{t(KEYS[source] ?? KEYS.manual)}</span>
}
