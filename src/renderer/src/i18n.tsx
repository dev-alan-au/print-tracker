import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  describeNote,
  pluralForm,
  resolveLocale,
  translate,
  type AppLanguage,
  type Locale,
  type MessageKey,
  type MessageParams,
  type NoteKey
} from '@shared/i18n'

export interface I18nValue {
  /** The concrete locale in use, after resolving `system`. */
  locale: Locale
  /** Translate a message key, substituting `{placeholders}`. */
  t(key: MessageKey, params?: MessageParams): string
  /** Pick the singular or plural variant for `count` and translate it. */
  tn(count: number, one: MessageKey, other: MessageKey, params?: MessageParams): string
  /** Render an app-generated event note, or null when the event has none. */
  note(noteKey: NoteKey | null | undefined, noteParams: MessageParams | null | undefined): string | null
}

const I18nContext = createContext<I18nValue | null>(null)

export function createI18n(locale: Locale): I18nValue {
  return {
    locale,
    t: (key, params) => translate(locale, key, params),
    tn: (count, one, other, params) =>
      translate(locale, pluralForm(locale, count) === 'one' ? one : other, {
        count,
        ...params
      }),
    note: (noteKey, noteParams) => describeNote(locale, noteKey, noteParams)
  }
}

export function I18nProvider({
  locale,
  children
}: {
  locale: Locale
  children: ReactNode
}) {
  const value = useMemo(() => createI18n(locale), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n() must be used inside <I18nProvider>')
  }
  return value
}

export { resolveLocale }
export type { AppLanguage, Locale }
