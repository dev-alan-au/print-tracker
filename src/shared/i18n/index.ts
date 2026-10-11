import { en } from './en'
import { ko } from './ko'
import type {
  AppLanguage,
  Catalog,
  Locale,
  MessageKey,
  MessageParams,
  NoteKey
} from './types'

export * from './types'
export { en, ko }

export const LOCALES: readonly Locale[] = ['en', 'ko']

export const CATALOGS: Record<Locale, Catalog> = { en, ko }

/** Native names, shown in the language picker. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어'
}

export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ko'
}

/**
 * Turns the stored preference into a concrete locale. `system` (or a missing
 * preference) falls back to the OS locale, then to English.
 */
export function resolveLocale(
  language: AppLanguage | null | undefined,
  systemLocale?: string | null
): Locale {
  if (language && language !== 'system') return language
  const tag = (systemLocale ?? '').toLowerCase()
  return tag.startsWith('ko') ? 'ko' : DEFAULT_LOCALE
}

/** Replaces `{placeholder}` tokens; unknown tokens are left untouched. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]
  const template = catalog[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  )
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

/**
 * `one` / `other` for the given count in the given locale. Korean only has the
 * `other` category, so its singular and plural strings are the same.
 */
export function pluralForm(locale: Locale, count: number): 'one' | 'other' {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }
  return rules.select(count) === 'one' ? 'one' : 'other'
}

/** Renders a system-generated event note, or null when there is none. */
export function describeNote(
  locale: Locale,
  noteKey: NoteKey | null | undefined,
  noteParams: MessageParams | null | undefined
): string | null {
  if (!noteKey) return null
  return translate(locale, noteKey, noteParams ?? undefined)
}
