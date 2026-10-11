import type { MessageKey } from '@shared/i18n'
import { useI18n } from '../i18n'

/**
 * The pages that carry an explainer. Mapped to catalogue keys so a typo or a
 * missing translation is a compile error rather than a blank panel.
 */
const HELP_KEYS = {
  overview: 'help.overview',
  dashboard: 'help.dashboard',
  folders: 'help.folders',
  files: 'help.files',
  history: 'help.history',
  query: 'help.query',
  settings: 'help.settings'
} as const satisfies Record<string, MessageKey>

export type HelpPage = keyof typeof HELP_KEYS

/**
 * A collapsed "what is this page?" explainer.
 *
 * Native `<details>` rather than a button and a state flag: it is keyboard
 * accessible and screen-reader friendly for free, and there is no open/closed
 * state to keep in sync with anything else.
 *
 * The body is one catalogue entry per page, with blank lines separating
 * paragraphs. That keeps a whole explanation readable as a single block of
 * prose in the translation files, which matters more than the structure a
 * translator would otherwise have to reassemble from numbered keys.
 */
export default function PageHelp({ page }: { page: HelpPage }) {
  const { t } = useI18n()

  return (
    <details className="page-help">
      <summary>
        <span className="page-help-icon" aria-hidden="true">
          ?
        </span>
        {t('help.summary')}
      </summary>
      <div className="page-help-body">
        {t(HELP_KEYS[page])
          .split('\n\n')
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
    </details>
  )
}
