// The account screens on the web: sign up -> "Confirm your email" with the code -> gone; Settings - change
// password; sign out; "Forgot password?" -> code -> new password -> signed in. Codes from the API log (QA).
const { API, openApp } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const log = path.join(__dirname, '.local', 'api.log')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let since = fs.readFileSync(log, 'utf8').length
const codeFor = async (email) => {
  for (let i = 0; i < 30; i++) {
    const m = fs.readFileSync(log, 'utf8').slice(since).split(/\r?\n/).filter((l) => l.includes(`DEV EMAIL to ${email}`)).at(-1)?.match(/(\d{6})/)
    if (m) { since = fs.readFileSync(log, 'utf8').length; return m[1] }
    await wait(300)
  }
  return null
}

;(async () => {
  const email = `qa-ui-${Date.now().toString(36)}@test.local`
  const { browser, page, errors, shot } = await openApp({ width: 420, height: 900, signIn: false })
  try {
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: /Create an account/ }).click()
    await page.getByLabel('Name').fill('UI Test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('First!Pass1')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.locator('.email-confirm').waitFor({ timeout: 15000 })
    check('after sign-up: "Confirm your email" shows', true)
    await shot('email-confirm')
    const code = await codeFor(email)
    await page.locator('.email-confirm input').fill(code)
    await page.locator('.email-confirm button[type=submit]').click()
    await page.locator('.email-confirm').waitFor({ state: 'detached', timeout: 10000 })
    check('the code confirms it and the box goes away', true)

    await page.goto('http://localhost:5173/settings'); await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Change password' }).click()
    await page.getByLabel('Current password').fill('First!Pass1')
    await page.getByLabel('New password').fill('Second!Pass2')
    await page.locator('.account-password button[type=submit]').click()
    await page.getByText('Password changed').waitFor({ timeout: 10000 })
    check('Settings: the password changes (and this device stays signed in)', page.url().includes('/settings'))
    await page.locator('.account-card').scrollIntoViewIfNeeded()
    await shot('account-card-security')

    // sign out, then forgot password
    await page.getByRole('button', { name: 'Sign out of all devices' }).click()
    await page.getByRole('button', { name: 'Forgot password?' }).waitFor({ timeout: 10000 })
    check('sign out of all devices -> the sign-in page, with "Forgot password?"', true)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send code' }).click()
    const reset = await codeFor(email)
    await page.getByLabel('Code').fill(reset)
    await page.getByLabel('New password').fill('Third!Pass3')
    await page.getByRole('button', { name: 'Set password and sign in' }).click()
    await page.waitForSelector('.app-header', { timeout: 15000 }) // signed in (back where it was)
    check('forgot password: code + new password -> signed in', true)
    const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Third!Pass3' }) })
    check('...the new password works', login.status === 200)
    const token = (await login.json()).accessToken
    await fetch(API + '/users/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmEmail: email, password: 'Third!Pass3' }) })
    console.log('page errors:', errors.filter((e) => !/401|400/.test(e)))
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
