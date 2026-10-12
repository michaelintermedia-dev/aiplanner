// Sign in with Google/Apple, through the QA-only "test" provider (unsigned tokens, Development only):
// a first sign-in makes the account, the next one finds it, a verified email links an existing account,
// a password can't be used on a provider-only account, and unconfigured providers are refused.
const { API, waitForApi, api } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
;(async () => {
  await waitForApi()
  const providers = await (await fetch(API + '/auth/providers')).json()
  check('providers: nothing set up locally, so no buttons', providers.googleClientId === null && providers.appleServicesId === null && providers.appleNative === false, JSON.stringify(providers))

  const tag = Date.now().toString(36)
  const email = `qa-social-${tag}@test.local`
  const ext = (sub, mail, name) => post('/auth/external', { provider: 'test', idToken: `test|${sub}|${mail}|${name ?? ''}`, timeZoneId: 'Asia/Jerusalem', locale: 'ru-RU' })

  const first = await ext(`sub-${tag}`, email, 'Social Tester')
  check('first sign-in makes the account', first.status === 200 && first.data.email === email, `${first.status} ${JSON.stringify(first.data?.errors ?? '')}`)
  const me = await (await fetch(API + '/users/me', { headers: { Authorization: 'Bearer ' + first.data.accessToken } })).json()
  check('the new account has the name, timezone and language', me.displayName === 'Social Tester' && me.timeZoneId === 'Asia/Jerusalem' && me.locale === 'ru-RU', JSON.stringify(me))

  const again = await ext(`sub-${tag}`, email, 'Other Name')
  check('the next sign-in finds the same account', again.status === 200 && again.data.userId === first.data.userId)

  const changed = await ext(`sub-${tag}`, `changed-${tag}@test.local`)
  check('a changed email at the provider still finds the account (by its id, not the email)', changed.status === 200 && changed.data.userId === first.data.userId)

  const pw = await post('/auth/login', { email, password: 'whatever123' })
  check('no password on a provider-only account', pw.status === 401 && /Google or Apple/.test(JSON.stringify(pw.data)), `${pw.status} ${JSON.stringify(pw.data)}`)

  const { call } = await api()
  const qa = (await call('GET', '/users/me')).data
  const link = await ext(`qa-${tag}`, 'feedtest@test.local')
  check('a verified email links the existing account', link.status === 200 && link.data.userId === qa.id)
  const stillPw = await post('/auth/login', { email: 'feedtest@test.local', password: 'Feed!Test123' })
  check('...and its password still works', stillPw.status === 200)

  const google = await post('/auth/external', { provider: 'google', idToken: 'not-a-token' })
  check('Google not set up: refused', google.status === 401)
  const fb = await post('/auth/external', { provider: 'facebook', idToken: 'x' })
  check('an unknown provider: refused', fb.status === 401)
  const bad = await post('/auth/external', { provider: 'test', idToken: 'garbage' })
  check('a malformed token: refused', bad.status === 401)
  const empty = await post('/auth/external', { provider: 'test', idToken: '' })
  check('an empty token: validation error', empty.status === 400)
  console.log('made:', email)
})().catch((e) => { console.error(e); process.exit(1) })
