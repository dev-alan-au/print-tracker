/**
 * Translation catalogue checks.
 *
 * The TypeScript types already guarantee that every locale covers every key.
 * This script covers what types cannot: placeholder mismatches between
 * languages, empty strings, unbalanced plural pairs and locale resolution.
 */
import {
  CATALOGS,
  LOCALES,
  describeNote,
  pluralForm,
  resolveLocale,
  translate,
  type Locale,
  type MessageKey
} from '../src/shared/i18n'

const results: string[] = []
const failures: string[] = []

function check(name: string, fn: () => void): void {
  try {
    fn()
    results.push(`PASS  ${name}`)
  } catch (error) {
    const line = `FAIL  ${name}\n        ${(error as Error).message}`
    results.push(line)
    failures.push(line)
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

const sourceKeys = Object.keys(CATALOGS.en) as MessageKey[]

/* -------------------------------------------------------------- key parity */

check('every locale exposes the same keys as the source locale', () => {
  for (const locale of LOCALES) {
    const keys = Object.keys(CATALOGS[locale]).sort()
    const missing = sourceKeys.filter((key) => !keys.includes(key))
    const extra = keys.filter((key) => !sourceKeys.includes(key))
    assert(missing.length === 0, `${locale} is missing: ${missing.join(', ')}`)
    assert(extra.length === 0, `${locale} has unknown keys: ${extra.join(', ')}`)
  }
})

check('no translation is empty or left as a key', () => {
  for (const locale of LOCALES) {
    for (const key of sourceKeys) {
      const value = CATALOGS[locale][key]
      assert(typeof value === 'string', `${locale}.${key} is not a string`)
      assert(value.trim().length > 0, `${locale}.${key} is empty`)
      assert(
        value !== key,
        `${locale}.${key} still contains the key itself (untranslated placeholder)`
      )
    }
  }
})

/* ------------------------------------------------------------ placeholders */

check('placeholders match between languages', () => {
  const problems: string[] = []
  for (const key of sourceKeys) {
    const expected = placeholders(CATALOGS.en[key])
    for (const locale of LOCALES) {
      if (locale === 'en') continue
      const actual = placeholders(CATALOGS[locale][key])
      if (expected.join(',') !== actual.join(',')) {
        problems.push(`${locale}.${key}: en has [${expected.join(', ')}], got [${actual.join(', ')}]`)
      }
    }
  }
  assert(problems.length === 0, problems.join('\n        '))
})

check('singular and plural variants come in pairs', () => {
  const problems: string[] = []
  for (const key of sourceKeys) {
    if (key.endsWith('.one') && !sourceKeys.includes(key.replace(/\.one$/, '.other') as MessageKey)) {
      problems.push(`${key} has no .other counterpart`)
    }
    if (key.endsWith('.other') && !sourceKeys.includes(key.replace(/\.other$/, '.one') as MessageKey)) {
      problems.push(`${key} has no .one counterpart`)
    }
  }
  assert(problems.length === 0, problems.join('; '))
})

/* --------------------------------------------------------------- behaviour */

check('translate substitutes every placeholder it is given', () => {
  eq(
    translate('en', 'sidebar.filesIndexed', { count: 12 }),
    '12 files indexed',
    'english substitution'
  )
  eq(translate('ko', 'sidebar.filesIndexed', { count: 12 }), '파일 12개 색인됨', 'korean substitution')
  eq(
    translate('en', 'folders.toast.rescanned', { name: 'Invoices', count: 3 }),
    'Rescanned "Invoices" — 3 file(s).',
    'multiple placeholders'
  )
})

check('translate leaves unknown placeholders untouched', () => {
  eq(translate('en', 'sidebar.filesIndexed', {}), '{count} files indexed', 'unfilled placeholder')
})

check('plural rules pick the right variant per language', () => {
  eq(pluralForm('en', 1), 'one', 'english singular')
  eq(pluralForm('en', 2), 'other', 'english plural')
  eq(pluralForm('en', 0), 'other', 'english zero')
  // Korean has a single plural category.
  eq(pluralForm('ko', 1), 'other', 'korean has no singular form')
})

/* --------------------------------------------------------- locale handling */

check('system locale resolves to a supported locale', () => {
  eq(resolveLocale('system', 'ko-KR'), 'ko', 'korean system locale')
  eq(resolveLocale('system', 'ko'), 'ko', 'korean bare tag')
  eq(resolveLocale('system', 'en-US'), 'en', 'english system locale')
  eq(resolveLocale('system', 'fr-FR'), 'en', 'unsupported system locale falls back')
  eq(resolveLocale(null, 'ko-KR'), 'ko', 'missing preference follows the system')
  eq(resolveLocale(undefined, ''), 'en', 'unknown system locale falls back')
})

check('an explicit choice overrides the system locale', () => {
  eq(resolveLocale('en', 'ko-KR'), 'en', 'explicit english wins')
  eq(resolveLocale('ko', 'en-US'), 'ko', 'explicit korean wins')
})

/* ------------------------------------------------------------ system notes */

check('event notes render from their key in either language', () => {
  const params = { folder: 'Spool' }
  eq(describeNote('en', 'note.outputNewFile', params), 'New file detected in output folder "Spool"', 'english note')
  eq(describeNote('ko', 'note.outputNewFile', params), '출력 폴더 "Spool"에서 새 파일을 감지했습니다', 'korean note')
  eq(describeNote('en', null, null), null, 'no key means no note')
})

check('all note keys are usable through describeNote', () => {
  for (const key of sourceKeys.filter((entry) => entry.startsWith('note.'))) {
    for (const locale of LOCALES as readonly Locale[]) {
      const rendered = describeNote(locale, key as never, null)
      assert(rendered && rendered.length > 0, `${locale}.${key} rendered nothing`)
    }
  }
})

console.log(results.join('\n'))
console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
process.exit(failures.length === 0 ? 0 : 1)
