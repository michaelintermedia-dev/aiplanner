import { en } from './en'
import { he } from './he'
import { ru } from './ru'

/**
 * UI language for web and mobile. Each language is one dictionary file with
 * the same keys as en.ts (the compiler flags a missing key). Adding a language
 * = a new file + a line in LANGUAGES (+ plural rules below if it has
 * unusual ones). Dates and numbers are formatted by Intl with the user's
 * locale, so they follow the language without any dictionary.
 *
 * The language is global (one user per app): the apps call setLocale() when
 * the user's locale is known and re-render; everything else calls t().
 */

/** Plural forms, picked by count (vars.count). Only the forms the language uses. */
export type Plural = { one: string; other: string; two?: string; few?: string; many?: string }
export type Message = string | Plural
export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, Message>
export type Vars = Record<string, string | number>

export const LANGUAGES = [
  { code: 'en', name: 'English', rtl: false, locale: 'en-US' },
  { code: 'ru', name: 'Русский', rtl: false, locale: 'ru-RU' },
  { code: 'he', name: 'עברית', rtl: true, locale: 'he-IL' },
] as const
export type Language = (typeof LANGUAGES)[number]['code']

const MESSAGES: Record<Language, Messages> = { en, ru, he }

/** "ru-RU" -> "ru"; unknown languages -> "en". ("iw" is Hebrew's old code, still sent by some Android versions.) */
export function languageOf(locale: string | null | undefined): Language {
  const code = (locale ?? '').split(/[-_]/)[0].toLowerCase()
  if (code === 'iw') return 'he'
  return LANGUAGES.some((l) => l.code === code) ? (code as Language) : 'en'
}

export const isRtl = (locale: string | null | undefined) => LANGUAGES.find((l) => l.code === languageOf(locale))!.rtl

/** The locale to save when the user picks `lang`: the device's own if it's the same language (keeps its region's formats). */
export function localeFor(lang: Language, deviceLocale: string): string {
  return languageOf(deviceLocale) === lang && deviceLocale.includes('-') ? deviceLocale : LANGUAGES.find((l) => l.code === lang)!.locale
}

/** CLDR plural category (Hermes has no Intl.PluralRules, so the rules are here). */
function pluralOf(lang: Language, n: number): keyof Plural {
  const i = Math.floor(Math.abs(n))
  const fraction = n % 1 !== 0
  switch (lang) {
    case 'ru':
      if (fraction) return 'other'
      if (i % 10 === 1 && i % 100 !== 11) return 'one'
      if (i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 12 || i % 100 > 14)) return 'few'
      return 'many'
    case 'he':
      if (i === 1 && !fraction) return 'one'
      if (i === 2 && !fraction) return 'two'
      return 'other'
    default:
      return i === 1 && !fraction ? 'one' : 'other'
  }
}

let language: Language = 'en'

export function setLocale(locale: string | null | undefined) {
  language = languageOf(locale)
}

export const currentLanguage = () => language

/** Translate: t('feed.select'), t('feed.deleted', { count: 3 }) - `{name}` placeholders are filled from vars. */
export function t(key: MessageKey, vars?: Vars): string {
  const message: Message | undefined = MESSAGES[language][key] ?? en[key]
  if (message === undefined) return key // e.g. a status the server added later
  let text = typeof message === 'string' ? message : (message[pluralOf(language, Number(vars?.count ?? 0))] ?? message.other)
  if (vars) text = text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
  return text
}
