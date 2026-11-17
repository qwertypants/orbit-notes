import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { buildOffline } from './build-offline.mjs'

const directory = resolve('dist')
const base = process.argv[2] || '/'
assert(base.startsWith('/') && base.endsWith('/'))
const temporary = await mkdtemp(resolve(tmpdir(), 'orbit-offline-'))
const nextDirectory = resolve(temporary, 'next')
await cp(directory, nextDirectory, { recursive: true })
const originalIndex = await readFile(resolve(directory, 'index.html'), 'utf8')
await writeFile(resolve(nextDirectory, 'index.html'), originalIndex.replace('<title>', '<title>Updated '))
const nextRelease = await buildOffline(nextDirectory)
let servedDirectory = directory
let corruptUpdate = false
const requests = []
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' }
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    requests.push(path)
    if (!path.startsWith(base)) throw new Error('Outside app')
    const file = path.slice(base.length) || 'index.html'
    const bytes = corruptUpdate && file === 'icon.svg'
      ? Buffer.from('Incomplete deployment')
      : await readFile(resolve(servedDirectory, file))
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const inspector = await context.newPage()
  const cdp = await context.newCDPSession(inspector)
  const versions = new Map()
  cdp.on('ServiceWorker.workerVersionUpdated', ({ versions: changes }) => {
    for (const version of changes) versions.set(version.versionId, version)
  })
  await cdp.send('ServiceWorker.enable')
  let page = await context.newPage()
  const errors = []
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin + base)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.waitForFunction(() => navigator.serviceWorker.controller)
  const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((file) => file.isFile() && file.name !== 'sw.js')
    .map((file) => `${base}${resolve(file.parentPath, file.name).slice(directory.length + 1)}`)
  const missing = await page.evaluate(async (files) => {
    const missing = []
    for (const file of files) if (!await caches.match(file)) missing.push(file)
    return missing
  }, files)
  assert.deepEqual(missing, [], 'The first installation must cache the entire release')
  const oldCache = await page.evaluate(async () => (await caches.keys()).find((key) => key.startsWith('orbit-offline:')))
  assert(oldCache)

  // A fresh page must work offline, even when audio was never used online.
  await context.setOffline(true)
  await page.close()
  page = await context.newPage()
  await page.goto(origin + base)
  await page.locator('#app .shell').waitFor()
  await page.locator('#note-circle canvas').waitFor()
  for (const sound of ['piano', 'guitar']) {
    await page.locator('#sound-select').selectOption(sound)
    await page.locator('#play-button').click()
    await page.waitForFunction(() => document.querySelector('#audio-status')?.textContent?.startsWith('Playing'))
    await page.locator('#play-button').click()
  }
  assert.deepEqual(errors, [], 'Offline UI and first-use audio must run without exceptions')
  console.log(`PASS ${base}: ${files.length} files cached; cold offline load, circle, piano and guitar playback`)

  await context.setOffline(false)
  await page.waitForLoadState('networkidle')
  const start = requests.length
  await page.reload()
  await page.locator('#note-circle canvas').waitFor()
  await page.waitForLoadState('networkidle')
  assert.deepEqual(requests.slice(start).filter((path) => path === base || files.includes(path)), [], 'Saved startup must not fetch application files')
  console.log(`PASS ${base}: online startup serves the saved app without network asset requests`)

  // Seed a second app's cache and the legacy worker's cache to check cleanup boundaries.
  const siblingCache = 'orbit-offline:/sibling/:keep'
  await page.evaluate(async ({ base, siblingCache }) => {
    await caches.open(siblingCache)
    const legacy = await caches.open('orbit-shell-v1')
    await legacy.put(`${base}old.js`, new Response('old'))
    if (base !== '/') await legacy.put('/sibling/keep.js', new Response('keep'))
  }, { base, siblingCache })
  servedDirectory = nextDirectory
  corruptUpdate = true
  const updateState = () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
    const worker = registration.installing || registration.waiting
    if (!worker) return 'none'
    if (['installed', 'redundant'].includes(worker.state)) return worker.state
    return new Promise((done) => worker.addEventListener('statechange', () => {
      if (['installed', 'redundant'].includes(worker.state)) done(worker.state)
    }))
  })
  assert.equal(await updateState(), 'redundant', 'A mismatched update must fail installation')
  assert.deepEqual(await page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith('orbit-offline:') && key !== 'orbit-offline:/sibling/:keep')), [oldCache])
  await context.setOffline(true)
  await page.reload()
  assert.equal(await page.title(), 'Orbit — Music Theory Explorer')
  await page.locator('#note-circle canvas').waitFor()
  console.log(`PASS ${base}: failed update removes its incomplete cache and preserves offline release A`)

  // A reconnect must download the update without an explicit registration.update().
  corruptUpdate = false
  await context.setOffline(false)
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed')
  assert.equal(await page.title(), 'Orbit — Music Theory Explorer', 'Waiting updates must not interrupt the open app')
  const waiting = [...versions.values()].find((version) => version.status === 'installed')
  assert(waiting, 'The complete update must be waiting')
  const activated = new Promise((done, fail) => {
    const timer = setTimeout(() => {
      cdp.off('ServiceWorker.workerVersionUpdated', listener)
      fail(new Error('The waiting update did not activate after closing the app'))
    }, 10000)
    const listener = ({ versions: changes }) => {
      if (changes.some((version) => version.versionId === waiting.versionId && version.status === 'activated')) {
        clearTimeout(timer)
        cdp.off('ServiceWorker.workerVersionUpdated', listener)
        done()
      }
    }
    cdp.on('ServiceWorker.workerVersionUpdated', listener)
  })
  await page.close()
  await activated
  page = await context.newPage()
  await context.setOffline(true)
  await page.goto(origin + base)
  assert.equal(await page.title(), 'Updated Orbit — Music Theory Explorer')
  await page.locator('#note-circle canvas').waitFor()
  const cachesAfterUpdate = await page.evaluate(() => caches.keys())
  assert(cachesAfterUpdate.includes(`orbit-offline:${base}:${nextRelease.release}`))
  assert(!cachesAfterUpdate.includes(oldCache))
  assert(cachesAfterUpdate.includes(siblingCache))
  assert.equal(await page.evaluate(async (base) => Boolean(await caches.match(`${base}old.js`)), base), false)
  if (base !== '/') assert.equal(await page.evaluate(async () => (await caches.match('/sibling/keep.js')).text()), 'keep')
  assert.deepEqual(errors, [])
  console.log(`PASS ${base}: complete update waits, activates after closing, opens offline, and cleans only its own caches`)
  await context.close()
} finally {
  await browser?.close()
  await new Promise((done) => server.close(done))
  await rm(temporary, { recursive: true, force: true })
}
