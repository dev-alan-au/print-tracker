import type { en } from './en'

/** Every valid message key, derived from the English catalogue. */
export type MessageKey = keyof typeof en

/** Shape every non-English catalogue must satisfy. */
export type Catalog = { [K in MessageKey]: string }

export type Locale = 'en' | 'ko'

/** What the user picked in Settings; `system` follows the OS locale. */
export type AppLanguage = 'system' | Locale

export type MessageParams = Record<string, string | number>

/**
 * Keys for notes that Print Tracker itself attaches to a print event. Keeping
 * these as keys rather than sentences means stored history re-renders in
 * whichever language the user selects later.
 */
export type NoteKey = Extract<MessageKey, `note.${string}`>
