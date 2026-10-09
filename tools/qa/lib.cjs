// Shared helpers for QA runs: the test API, the browser, fake voice uploads, and the AI budget.
// Everything talks to the QA copy of the API on :58600 as the QA account - never the developer's
// own account or running backend.
const fs = require('fs')
const path = require('path')

const API = 'http://localhost:58600/api'
const WEB = 'http://localhost:5173'
const ACCOUNT = { email: 'feedtest@test.local', password: 'Feed!Test123' }
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.join(__dirname, 'out')

// ---- AI budget: every capture (text or voice) costs a real OpenAI call ----
const BUDGET = Number(process.env.QA_AI_BUDGET ?? 20)
const budgetFile = path.join(OUT, 'ai-calls.txt')
function spendAi(what) {
  fs.mkdirSync(OUT, { recursive: true })
  const used = Number(fs.existsSync(budgetFile) ? fs.readFileSync(budgetFile, 'utf8') : 0)
  if (used >= BUDGET) throw new Error(`AI budget used up (${used}/${BUDGET}) - not sending ${what}`)
  fs.writeFileSync(budgetFile, String(used + 1))
  return used + 1
}
const aiCallsUsed = () => Number(fs.existsSync(budgetFile) ? fs.readFileSync(budgetFile, 'utf8') : 0)
const isAiCall = (method, url) => method === 'POST' && /\/api\/captures(\/text|\/voice|\/[^/]+\/continue)$/.test(new URL(url).pathname)

async function waitForApi(seconds = 90) {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(API + '/health')).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('The QA API on :58600 is not up - run start-api.ps1 first')
}

// ---- API client ----
async function api() {
  await waitForApi()
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ACCOUNT) })).json()
  if (!login.accessToken) throw new Error('QA login failed')
  const auth = { Authorization: 'Bearer ' + login.accessToken }
  const call = async (method, p, body) => {
    if (isAiCall(method, API + p)) spendAi(`${method} ${p}`)
    const isForm = body instanceof FormData
    const r = await fetch(API + p, {
      method,
      headers: isForm ? auth : { ...auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
    const text = await r.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: r.status, data }
  }
  return { call, token: login.accessToken }
}

/** A WAV from say.ps1 (SAPI writes an 18-byte fmt chunk) rewritten with a clean 44-byte header. */
function cleanWav(file) {
  const wav = fs.readFileSync(file)
  const fmt = wav.readUInt32LE(16)
  const data = wav.subarray(20 + fmt + 8)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24)
  h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/** FormData with one or more WAV parts, as the apps upload them. */
function audioForm(files, extra = {}) {
  const form = new FormData()
  for (const f of [files].flat()) form.append('audio', new Blob([cleanWav(f)], { type: 'audio/wav' }), path.basename(f))
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  return form
}

// ---- Browser ----
/**
 * Chrome on the web app (Vite dev server, :5173) with its API calls sent to the QA API, signed in
 * as the QA account. width 420 = phone, 1280 = desktop. Collects page errors and console errors.
 */
// `micWav`: a WAV file the fake microphone plays (loops) - for voice flows.
async function openApp({ width = 420, height = 900, signIn = true, micWav = null } = {}) {
  const { chromium } = require('playwright-core')
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      ...(micWav ? [`--use-file-for-fake-audio-capture=${micWav}`] : [])],
  })
  const context = await browser.newContext({ viewport: { width, height }, permissions: ['microphone', 'notifications'] })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const req = route.request()
    if (isAiCall(req.method(), req.url())) {
      try {
        spendAi(`${req.method()} ${new URL(req.url()).pathname}`)
      } catch (e) {
        return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ errors: [String(e.message)] }) })
      }
    }
    const res = await route.fetch({ url: req.url().replace(/^https?:\/\/[^/]+/, 'http://localhost:58600') })
    await route.fulfill({ response: res })
  })
  if (signIn) {
    await page.goto(WEB)
    await page.getByLabel('Email').fill(ACCOUNT.email)
    await page.getByLabel('Password').fill(ACCOUNT.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForSelector('.feed-row, .empty', { timeout: 30000 })
  }
  return { browser, page, errors, shot: (name) => shot(page, name) }
}

/** Saves a screenshot to out/ and returns its path (for the report). */
async function shot(target, name) {
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, `${name}.png`)
  await target.screenshot({ path: file })
  return file
}

module.exports = { API, WEB, ACCOUNT, OUT, api, openApp, shot, audioForm, cleanWav, waitForApi, aiCallsUsed, spendAi }
