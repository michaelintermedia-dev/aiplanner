// Account security: email confirmation code (AI waits for it), change / set password, sign out everywhere,
// forgot password, the Google/Apple takeover fix, delete needs the password. Codes come from the API log
// (Email:DevLog, QA only). Throwaway accounts, deleted at the end.
const { API, waitForApi, spendAi } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const log = path.join(__dirname, '.local', 'api.log')
const req = async (method, p, body, token) => {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data }
}
/** The newest code mailed to this address (the dev log: "DEV EMAIL to x: Your Gatazee code: 123456"). */
let since = 0
const codeFor = async (email) => {
  for (let i = 0; i < 20; i++) {
    const lines = fs.readFileSync(log, 'utf8').slice(since).split(/\r?\n/).filter((l) => l.includes(`DEV EMAIL to ${email}`))
    const m = lines.at(-1)?.match(/(\d{6})/)
    if (m) return m[1]
    await wait(300)
  }
  return null
}
// Only codes mailed from now on count (the API holds the log open - it can't be edited).
const clearCodes = () => {
  since = fs.readFileSync(log, 'utf8').length
}

;(async () => {
  await waitForApi()
  const tag = Date.now().toString(36)
  const email = `qa-sec-${tag}@test.local`
  const providers = (await req('GET', '/auth/providers')).data
  check('the server says email is on', providers.emailEnabled === true, JSON.stringify(providers))

  // 1. sign up -> a code; AI waits for it
  let reg = (await req('POST', '/auth/register', { email, password: 'First!Pass1', displayName: 'Sec', timeZoneId: 'UTC', locale: 'ro-RO' })).data
  let me = (await req('GET', '/users/me', undefined, reg.accessToken)).data
  check('a new account is not confirmed and has a password', me.emailConfirmed === false && me.hasPassword === true, JSON.stringify(me))
  const code = await codeFor(email)
  check('sign-up mails a code', !!code)
  const blocked = await req('POST', '/captures/text', { text: 'test' }, reg.accessToken)
  check('the AI waits for a confirmed email', blocked.status === 403 && blocked.data.code === 'email_unconfirmed', `${blocked.status} ${JSON.stringify(blocked.data)}`)
  const wrong = await req('POST', '/auth/email/verify', { code: code === '000000' ? '111111' : '000000' }, reg.accessToken)
  check('a wrong code is refused', wrong.status === 400)
  const right = await req('POST', '/auth/email/verify', { code: code.slice(0, 3) + ' ' + code.slice(3) }, reg.accessToken)
  check('the right code (typed with a space) confirms', right.status === 204)
  me = (await req('GET', '/users/me', undefined, reg.accessToken)).data
  check('...and the account is confirmed', me.emailConfirmed === true)
  spendAi('confirmed capture')
  const allowed = await req('POST', '/captures/text', { text: 'Buy stamps' }, reg.accessToken)
  check('then the AI works', allowed.status === 200, `${allowed.status}`)
  const again = await req('POST', '/auth/email/verify', { code }, reg.accessToken)
  check('a used code does nothing more (already confirmed: OK)', again.status === 204)

  // 2. change password
  const badChange = await req('POST', '/auth/password', { currentPassword: 'nope-nope', newPassword: 'Second!Pass2' }, reg.accessToken)
  check('changing needs the current password', badChange.status === 400 && /current password/.test(JSON.stringify(badChange.data)))
  const changed = await req('POST', '/auth/password', { currentPassword: 'First!Pass1', newPassword: 'Second!Pass2' }, reg.accessToken)
  check('the password changes and this device gets new tokens', changed.status === 200 && !!changed.data.refreshToken)
  const oldSession = await req('POST', '/auth/refresh', { refreshToken: reg.refreshToken })
  check('...other sessions end', oldSession.status === 401)
  check('...the old password stops working', (await req('POST', '/auth/login', { email, password: 'First!Pass1' })).status === 401)
  const login2 = await req('POST', '/auth/login', { email, password: 'Second!Pass2' })
  check('...the new one works', login2.status === 200)

  // 3. sign out everywhere
  await req('POST', '/auth/sign-out-everywhere', undefined, login2.data.accessToken)
  check('sign out everywhere ends every session', (await req('POST', '/auth/refresh', { refreshToken: login2.data.refreshToken })).status === 401 && (await req('POST', '/auth/refresh', { refreshToken: changed.data.refreshToken })).status === 401)

  // 4. forgot password
  clearCodes()
  const nobody = await req('POST', '/auth/password/forgot', { email: `nobody-${tag}@test.local` })
  check('forgot password for an unknown address looks the same (no account check)', nobody.status === 204)
  check('...and mails nothing', (await codeFor(`nobody-${tag}@test.local`)) === null)
  await req('POST', '/auth/password/forgot', { email: email.toUpperCase() })
  const resetCode = await codeFor(email)
  check('forgot password mails a code', !!resetCode)
  const badReset = await req('POST', '/auth/password/reset', { email, code: '999999', newPassword: 'Third!Pass3' })
  check('a wrong reset code is refused', badReset.status === 400)
  const reset = await req('POST', '/auth/password/reset', { email, code: resetCode, newPassword: 'Third!Pass3' })
  check('the reset code sets the password and signs in', reset.status === 200 && !!reset.data.accessToken)
  check('...the old password is gone', (await req('POST', '/auth/login', { email, password: 'Second!Pass2' })).status === 401)
  check('...a reset code works once', (await req('POST', '/auth/password/reset', { email, code: resetCode, newPassword: 'Fourth!Pass4' })).status === 400)

  // 5. delete needs the password
  const noPw = await req('DELETE', '/users/me', { confirmEmail: email }, reset.data.accessToken)
  check('deleting a password account needs the password', noPw.status === 400 && /password/i.test(JSON.stringify(noPw.data)))

  // 6. the takeover fix: someone signs up with your address; you then sign in with Google
  const victim = `qa-victim-${tag}@test.local`
  const attacker = (await req('POST', '/auth/register', { email: victim, password: 'Attacker!1', displayName: 'Not you', timeZoneId: 'UTC', locale: 'en-US' })).data
  const google = await req('POST', '/auth/external', { provider: 'test', idToken: `test|victim-${tag}|${victim}|Victim`, timeZoneId: 'UTC', locale: 'en-US' })
  check('signing in with Google links the unconfirmed account', google.status === 200 && google.data.userId === attacker.userId)
  check('...the password that someone else set stops working', (await req('POST', '/auth/login', { email: victim, password: 'Attacker!1' })).status === 401)
  check('...their session ends', (await req('POST', '/auth/refresh', { refreshToken: attacker.refreshToken })).status === 401)
  const vme = (await req('GET', '/users/me', undefined, google.data.accessToken)).data
  check('...the account is confirmed, without a password', vme.emailConfirmed === true && vme.hasPassword === false, JSON.stringify(vme))
  const setPw = await req('POST', '/auth/password', { newPassword: 'Victim!Pass1' }, google.data.accessToken)
  check('a Google-only account can set a password (no current one)', setPw.status === 200)
  check('...and sign in with it', (await req('POST', '/auth/login', { email: victim, password: 'Victim!Pass1' })).status === 200)

  // clean up
  await req('DELETE', '/users/me', { confirmEmail: email, password: 'Third!Pass3' }, reset.data.accessToken)
  await req('DELETE', '/users/me', { confirmEmail: victim, password: 'Victim!Pass1' }, setPw.data.accessToken)
  check('deleted with the password', (await req('POST', '/auth/login', { email, password: 'Third!Pass3' })).status === 401)
})().catch((e) => { console.error(e); process.exit(1) })
