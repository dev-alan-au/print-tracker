import type { AppLanguage } from '@shared/i18n'
import type { AppTheme } from '@shared/types'

const LANGUAGE_KEY = 'print-tracker.language'
const THEME_KEY = 'print-tracker.theme'

/**
 * The database is the source of truth for these preferences, but reading it is
 * asynchronous. Mirroring them into localStorage lets the very first paint use
 * the right language and colour scheme instead of flashing the defaults.
 */

export function readCachedLanguage(): AppLanguage {
  try {
    const cached = window.localStorage.getItem(LANGUAGE_KEY)
    if (cached === 'en' || cached === 'ko' || cached === 'system') return cached
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

export function writeCachedLanguage(language: AppLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    /* storage unavailable; the database still remembers the choice */
  }
}

export function readCachedTheme(): AppTheme | null {
  try {
    const cached = window.localStorage.getItem(THEME_KEY)
    if (cached === 'light' || cached === 'dark') return cached
  } catch {
    /* storage unavailable */
  }
  return null
}

export function writeCachedTheme(theme: AppTheme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* storage unavailable; the database still remembers the choice */
  }
}

/** Themes are plain token overrides keyed off `[data-theme]` on the root. */
export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset['theme'] = theme
}

/**
 * Drops the first-paint cache.
 *
 * Called when the application is reset: the database - the source of truth for
 * these preferences - is empty again, so a stale cache would keep painting the
 * previous theme and language until the settings round trip completed.
 */
export function clearCachedPreferences(): void {
  try {
    window.localStorage.removeItem(LANGUAGE_KEY)
    window.localStorage.removeItem(THEME_KEY)
  } catch {
    /* storage unavailable; nothing was cached to begin with */
  }
}
