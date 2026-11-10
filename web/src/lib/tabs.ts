import { t } from '@shared/i18n'

/**
 * The bottom navigation (spec v2, 2026-10-31): Feed · Today · Calendar, the
 * same as the app's tab bar. Settings is the header's gear (top-right, 2026-11-01).
 * Other pages (an item, Settings, admin) open on top with a back arrow and no bar.
 */
export const TABS = [
  { path: '/feed', get label() { return t('nav.feed') } },
  { path: '/today', get label() { return t('nav.today') } },
  { path: '/calendar', get label() { return t('nav.calendar') } },
] as const

export const isTabPage = (pathname: string) => TABS.some((tab) => pathname === tab.path)

/** A tab clicked while its page is open (Today: back to today, 2026-11-10). */
const reselect = new Map<string, Set<() => void>>()
export function tabReselected(path: string) {
  reselect.get(path)?.forEach((l) => l())
}
export function onTabReselect(path: string, listener: () => void): () => void {
  if (!reselect.has(path)) reselect.set(path, new Set())
  reselect.get(path)!.add(listener)
  return () => reselect.get(path)?.delete(listener)
}
