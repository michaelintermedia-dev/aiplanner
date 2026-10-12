// Every app language: the web app renders in it (no untranslated keys on the main pages), Arabic and
// Hebrew are right-to-left, and the server's notification texts follow the language too.
const { api, openApp } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const LOCALES = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'it-IT', 'pl-PL', 'uk-UA', 'ru-RU', 'tr-TR', 'he-IL', 'ar', 'hi-IN', 'zh-CN', 'ja-JP', 'ko-KR']
const SHOTS = new Set(['ar', 'ja-JP', 'hi-IN', 'de-DE'])
// A key that slipped through untranslated looks like "feed.tab.all" (t() returns the key itself).
const KEY = /\b(?:kind|date|feed|filter|draft|calendar|reminder|app|common|nav|auth|settings|today|select|task|status|priority|changeType|item|tags|event|note|capture|mic|review|source|dock|player|notifications|sort|repeat|pull|form|media|consent|widget|theme|skin|place|account|admin)\.[a-zA-Z.]+\b/

;(async () => {
  const { call } = await api()
  const me = (await call('GET', '/users/me')).data
  const { browser, page, errors, shot } = await openApp({ width: 420, height: 900 })
  try {
    for (const locale of LOCALES) {
      await new Promise((r) => setTimeout(r, 3500)) // stay under the auth rate limit
      const set = await call('PATCH', '/users/me', { locale })
      if (set.status !== 200) { check(`${locale}: saved on the account`, false, JSON.stringify(set.data)); continue }
      const leftovers = []
      // One reload per language (it signs in again - the auth rate limit is 20 a minute), then in-app navigation.
      await page.goto('http://localhost:5173/feed')
      await page.waitForSelector('.feed-row, .empty', { timeout: 20000 })
      for (const p of ['/feed', '/today', '/calendar', '/settings']) {
        await page.evaluate((path) => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, p)
        await page.waitForTimeout(1300)
        const text = await page.locator('body').innerText()
        const m = text.match(KEY)
        if (m) leftovers.push(`${p}: ${m[0]}`)
      }
      const dir = await page.evaluate(() => document.documentElement.dir || 'ltr')
      const rtl = locale === 'ar' || locale === 'he-IL'
      const upcoming = (await call('GET', '/notifications/upcoming?hours=48')).data
      check(`${locale}: web in that language, ${rtl ? 'right-to-left' : 'left-to-right'}`, leftovers.length === 0 && dir === (rtl ? 'rtl' : 'ltr'), leftovers.length ? leftovers.join('; ') : `dir=${dir}, ${upcoming.length} upcoming`)
      if (SHOTS.has(locale)) {
        await shot(`lang-${locale}-settings`) // still on /settings
        await page.evaluate(() => { history.pushState({}, '', '/feed'); dispatchEvent(new PopStateEvent('popstate')) })
        await page.waitForTimeout(1200)
        await shot(`lang-${locale}-feed`)
      }
    }
    // A daily summary is made on the server in the user's language.
    await call('PATCH', '/users/me', { locale: 'de-DE' })
    const de = (await call('GET', '/notifications/upcoming?hours=48')).data.find((n) => n.kind === 'DailySummary' || /summary|Tag/i.test(n.title ?? ''))
    console.log('German daily summary:', de ? `${de.title} - ${de.body}` : '(none in the next 48 h)')
    console.log('page errors:', errors.filter((e) => !/favicon/.test(e)))
  } finally {
    await call('PATCH', '/users/me', { locale: me.locale })
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
