import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { _electron } from 'playwright-core'

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'threatbrowser-smoke-'))
  const dataDir = path.join(root, 'data')
  const tempDir = path.join(root, 'temp')
  const outputDir = process.env.THREATBROWSER_SMOKE_OUTPUT || path.join(root, 'evidence')
  await Promise.all(
    [dataDir, tempDir, outputDir].map((directory) => fs.mkdir(directory, { recursive: true }))
  )
  const hits = new Map()
  const reports = []
  const fixture = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    hits.set(url.pathname, (hits.get(url.pathname) || 0) + 1)
    if (url.pathname === '/report') {
      let text = ''
      for await (const chunk of request) text += chunk
      reports.push(JSON.parse(text))
      response.end('ok')
    } else if (url.pathname === '/pixel.png') {
      response.setHeader('Content-Type', 'image/png')
      response.end(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64'
        )
      )
    } else if (url.pathname === '/media.webm') {
      response.setHeader('Content-Type', 'video/webm')
      response.end()
    } else if (url.pathname === '/cache.js') {
      response.setHeader('Cache-Control', 'max-age=3600')
      response.setHeader('Content-Type', 'application/javascript')
      response.end('window.cachedFixture = true')
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.setHeader(
        'Set-Cookie',
        `${url.pathname === '/b' ? 'second' : 'session'}=fixture; Path=/; SameSite=Lax`
      )
      response.end(`<!doctype html><title>Fixture ${url.pathname}</title><script>
      const first = {path: location.pathname, ua: navigator.userAgent, language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, cores: navigator.hardwareConcurrency,
        width: innerWidth, outerWidth, screenWidth: screen.width};
      window.fixtureReady = (async () => {
        first.brands = navigator.userAgentData?.brands;
        first.permission = (await navigator.permissions.query({name:'geolocation'})).state;
        first.notifications = (await navigator.permissions.query({name:'notifications'})).state;
        first.location = await new Promise(resolve => {
          let done = false;
          const attempt = (tries) => navigator.geolocation.getCurrentPosition(p => { if (!done) { done = true; resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}); } }, e => { if (e.code === 3 && tries > 0) { setTimeout(() => attempt(tries - 1), 250); } else { if (!done) { done = true; resolve({error:e.code}); } } }, {timeout:2500});
          attempt(3);
        });
        const gl = document.createElement('canvas').getContext('webgl');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        first.gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
        await fetch('/report',{method:'POST',body:JSON.stringify(first)});
        return first;
      })();
      </script><h1 id="ready">ThreatBrowser fixture</h1><input aria-label="Fixture input"><button id="target" onclick="window.clicked=true">Target</button><button id="popup" onclick="window.open('/popup')">Popup</button><img src="/pixel.png"><video src="/media.webm" preload="auto"></video><script src="/cache.js"></script><div style="height:1200px">Scroll fixture</div>`)
    }
  })
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${fixture.address().port}`
  let application
  const env = { ...process.env, THREATBROWSER_DATA_DIR: dataDir, TMPDIR: tempDir }
  delete env.ELECTRON_RENDERER_URL
  delete env.ELECTRON_RUN_AS_NODE
  const pass = (name) => console.log(`PASS ${name}`)
  try {
    application = await _electron.launch({
      args: ['.', `--user-data-dir=${path.join(root, 'electron')}`],
      cwd: process.cwd(),
      env,
      timeout: 30000
    })
    const window = await application.firstWindow()
    await window.getByRole('heading', { name: 'Profiles', exact: true }).waitFor()
    assert.equal(
      await window.evaluate(() => typeof window.electron?.ipcRenderer?.invoke),
      'function'
    )
    pass('actual Electron renderer and preload')
    if (!process.argv.includes('--ui-only')) {
      const saved = await window.evaluate(
        async (origin) =>
          window.electron.ipcRenderer.invoke('create-profile', {
            id: 0,
            name: 'Runtime fixture',
            useragent: '',
            notes: '',
            proxy: '',
            launched: false,
            platform: 'windows',
            browserIdentity: 'edge',
            geoip: false,
            locale: 'en-GB',
            timezone: 'Europe/London',
            width: 1234,
            height: 876,
            startPages: [origin + '/a', origin + '/b'],
            fingerprint: {
              hardwareConcurrency: 12,
              geolocation: { latitude: 51.5, longitude: -0.12, accuracy: 25 }
            },
            permissionRules: [{ origin, geolocation: 'allow', notifications: 'deny' }],
            resources: { blockImages: true, blockMedia: true, cacheEnabled: true }
          }),
        origin
      )
      await window.evaluate(
        (profile) => window.electron.ipcRenderer.invoke('launch-profile', profile),
        saved
      )
      const deadline = Date.now() + 20000
      while (reports.length < 2 && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100))
      assert.equal(reports.length, 2, 'both app-created start tabs report')
      for (const report of reports) {
        assert.match(report.ua, /Windows NT.*Chrome\/\d+.*Edg\//)
        assert.equal(report.cores, 12)
        assert.equal(report.language, 'en-GB')
        assert.equal(report.timezone, 'Europe/London')
        assert.equal(report.permission, 'granted')
        assert.equal(report.notifications, 'denied')
        assert.deepEqual(report.location, { latitude: 51.5, longitude: -0.12, accuracy: 25 })
        assert.doesNotMatch(report.gpu, /Apple|Metal/)
        assert.ok(report.outerWidth >= report.width)
      }
      assert.equal(hits.get('/pixel.png') || 0, 0)
      assert.equal(hits.get('/media.webm') || 0, 0)
      assert.ok(hits.get('/cache.js') > 0)
      pass(
        'real CloakBrowser identity, location, permissions and resource blocking on both start tabs'
      )
      await window.evaluate(
        (id) => window.electron.ipcRenderer.invoke('profile:stop', id),
        saved.id
      )
      const loaded = await window.evaluate(() =>
        window.electron.ipcRenderer.invoke('load-profiles')
      )
      assert.equal(loaded[0].launched, false)
      const cookies = JSON.parse(loaded[0].cookies)
      assert.ok(cookies.some((cookie) => cookie.name === 'session'))
      assert.ok(cookies.some((cookie) => cookie.name === 'second'))
      pass('stop waits for cookie persistence across tabs')
    } else console.log('UNRUN engine cases (--ui-only)')
    await window.screenshot({ path: path.join(outputDir, 'profiles.png') })
    await fs.writeFile(
      path.join(outputDir, 'runtime.json'),
      JSON.stringify({ reports, hits: Object.fromEntries(hits) }, null, 2)
    )
    console.log(`Evidence: ${outputDir}`)
  } catch (error) {
    console.error(`FAIL ${error.stack || error}`)
    process.exitCode = 1
  } finally {
    await application?.close().catch(() => undefined)
    await new Promise((resolve) => fixture.close(resolve))
  }
}

void main()
