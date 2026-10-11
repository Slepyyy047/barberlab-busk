import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const STARTUP_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  if (!await Promise.race([once(child, 'exit').then(() => true), delay(5_000).then(() => false)])) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

async function waitForServer(baseURL, child, output) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited (${child.exitCode})\n${output()}`);
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (response.status === 200 && (await response.json()).status === 'ok') return;
    } catch { /* Server is not accepting requests yet. */ }
    await delay(250);
  }
  throw new Error(`Next.js did not become healthy within ${STARTUP_TIMEOUT_MS} ms\n${output()}`);
}

function provisionTemporaryAdmin(dataDir, username, password) {
  const source = "import {provisionAdmin} from './lib/auth.ts';provisionAdmin(process.env.BARBERLAB_ADMIN_USER,process.env.BARBERLAB_ADMIN_PASSWORD);";
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, BARBERLAB_DATA_DIR: dataDir, BARBERLAB_ADMIN_USER: username, BARBERLAB_ADMIN_PASSWORD: password },
  });
  assert.equal(result.status, 0, `Could not provision the isolated accessibility-test user: ${result.stderr || result.stdout}`);
}

async function contrastOf(locator) {
  return locator.evaluate((element) => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const channels = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      if (channels.length < 3) return null;
      return { rgb: channels.slice(0, 3), alpha: channels.length > 3 ? channels[3] : 1 };
    };
    const toLinear = (channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
    const foreground = parse(getComputedStyle(element).color);
    let background = [255, 255, 255];
    for (let node = element; node; node = node.parentElement) {
      const candidate = parse(getComputedStyle(node).backgroundColor);
      if (candidate && candidate.alpha > 0) {
        background = candidate.rgb.map((value, index) => value * candidate.alpha + background[index] * (1 - candidate.alpha));
        if (candidate.alpha >= 1) break;
      }
    }
    if (!foreground) throw new Error('target uses a measurable foreground color');
    const foregroundRGB = foreground.rgb.map((value, index) => value * foreground.alpha + background[index] * (1 - foreground.alpha));
    const values = [luminance(foregroundRGB), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
}

async function assertTextContrast(page, selectors, label) {
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    await target.waitFor();
    const ratio = await contrastOf(target);
    assert.ok(ratio >= 4.5, `${label} ${selector} contrast is ${ratio.toFixed(2)}:1 (minimum 4.5:1)`);
  }
}

async function assertNoHorizontalOverflow(page, route) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport, `${route} overflows at mobile width: ${JSON.stringify(dimensions)}`);
}

function contrastRatio(foreground, background) {
  const channels = (value) => value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (value) => {
    const rgb = channels(value);
    assert.ok(rgb, `expected an rgb color, got ${value}`);
    return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function main() {
  const repoRoot = process.cwd();
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'barberlab-accessibility-'));
  const username = `accessibility-${Date.now()}`;
  const password = `Test-${Date.now()}-A11y!`;
  const port = await getFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const nextCli = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  provisionTemporaryAdmin(dataDir, username, password);
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: 'production', BARBERLAB_DATA_DIR: dataDir, BARBERLAB_APP_ORIGIN: baseURL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const append = (chunk) => { output = `${output}${chunk}`.slice(-20_000); };
  child.stdout.setEncoding('utf8').on('data', append);
  child.stderr.setEncoding('utf8').on('data', append);
  let browser;
  try {
    await waitForServer(baseURL, child, () => output);
    browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await assertNoHorizontalOverflow(page, '/');
    const screenshotDir = path.join(repoRoot, 'verification', 'accessibility');
    await mkdir(screenshotDir, { recursive: true });
    await page.locator('.cookie-banner').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'home-cookie-banner-390.png') });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link', 'first Tab reaches the visible skip link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main', 'skip link moves focus to the main landmark');

    const menuToggle = page.getByRole('button', { name: 'Відкрити меню' });
    await menuToggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.menu-toggle')?.getAttribute('aria-expanded') === 'true');
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Атмосфера', { timeout: 5_000 }).catch(async () => {
      const state = await page.evaluate(() => ({ mobile: matchMedia('(max-width: 780px)').matches, expanded: document.querySelector('.menu-toggle')?.getAttribute('aria-expanded'), inert: document.querySelector('#primary-nav')?.hasAttribute('inert'), active: document.activeElement?.outerHTML }));
      throw new Error(`Mobile menu did not move focus: ${JSON.stringify(state)}`);
    });
    const focusStyle = await page.evaluate(() => {
      const link = document.activeElement;
      const nav = document.querySelector('#primary-nav');
      const toggle = document.querySelector('.menu-toggle');
      const linkBox = link?.getBoundingClientRect();
      const toggleBox = toggle?.getBoundingClientRect();
      return {
        outline: link ? getComputedStyle(link).outlineColor : '',
        navBackground: nav ? getComputedStyle(nav).backgroundColor : '',
        linkTarget: linkBox ? [linkBox.width, linkBox.height] : [0, 0],
        toggleTarget: toggleBox ? [toggleBox.width, toggleBox.height] : [0, 0],
      };
    });
    assert.ok(contrastRatio(focusStyle.outline, focusStyle.navBackground) >= 3, 'keyboard focus indicator contrasts at least 3:1 against the dark menu');
    assert.ok(focusStyle.linkTarget.every((size) => size >= 24), 'mobile navigation links meet the 24px target minimum');
    assert.ok(focusStyle.toggleTarget.every((size) => size >= 24), 'mobile menu toggle meets the 24px target minimum');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Атмосфера', 'opening mobile navigation moves focus to its first link');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Відкрити меню' }).getAttribute('aria-expanded'), 'false', 'Escape closes mobile navigation');
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'menu-toggle', 'Escape returns focus to the menu toggle');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.closest('nav')?.id), 'primary-nav', 'closed menu links are removed from keyboard navigation');

    const homeImages = await page.locator('img').evaluateAll((images) => images.map((image) => ({ src: image.getAttribute('src'), hasAlt: image.hasAttribute('alt') })));
    assert.ok(homeImages.length > 0, 'home page renders supplied images');
    assert.ok(homeImages.every((image) => image.hasAlt), `every image declares alt text (missing: ${homeImages.filter((image) => !image.hasAlt).map((image) => image.src).join(', ')})`);
    await assertTextContrast(page, ['.experience-stage-caption', '.review-rating strong span', '.review-rating small', '.cookie-banner p', '.cookie-actions button'], 'home');

    await page.goto(`${baseURL}/services`, { waitUntil: 'networkidle' });
    await assertTextContrast(page, ['.row-number'], 'services');
    await page.goto(`${baseURL}/team`, { waitUntil: 'networkidle' });
    await assertTextContrast(page, ['.person-index', '.team-level'], 'team');
    for (const route of ['/privacy', '/terms', '/cookies', '/licenses']) {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      await assertNoHorizontalOverflow(page, route);
    }

    const googleMapRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'maps.google.com') googleMapRequests.push(request.url());
    });
    await page.getByRole('button', { name: 'Лише необхідні' }).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('barberlab_cookie_preferences') || '{}').externalMedia), false, 'rejecting optional media persists the choice');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.cookie-banner').count(), 0, 'rejected choice stays dismissed after reload');
    await page.goto(`${baseURL}/contacts`, { waitUntil: 'networkidle' });
    await assertNoHorizontalOverflow(page, '/contacts');
    assert.equal(await page.locator('.map-panel iframe').count(), 0, 'map remains a placeholder until consent and explicit activation');
    assert.equal(googleMapRequests.length, 0, 'Google map is not requested before consent');
    await page.locator('.map-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'contacts-map-placeholder-390.png') });
    await page.getByRole('button', { name: 'Налаштувати cookie для карти' }).click();
    await page.getByRole('checkbox', { name: /Зовнішній контент/ }).check();
    await page.getByRole('button', { name: 'Зберегти вибір' }).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('barberlab_cookie_preferences') || '{}').externalMedia), true, 'map consent is persisted');
    await page.route('https://maps.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Map test fixture</p>' }));
    await page.getByRole('button', { name: 'Показати карту' }).click();
    await page.locator('.map-panel iframe').waitFor();
    assert.ok(googleMapRequests.length > 0, 'map request is made only after consent and explicit activation');
    await page.getByRole('button', { name: 'Налаштування cookie' }).click();
    const consentCheckbox = page.getByRole('checkbox', { name: /Зовнішній контент/ });
    await consentCheckbox.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('.consent-option input')?.checked);
    await page.getByRole('button', { name: 'Зберегти вибір' }).click();
    assert.equal(await page.locator('.map-panel iframe').count(), 0, 'revoking consent removes the embedded map');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('barberlab_cookie_preferences') || '{}').externalMedia), false, 'revoked permission stays disabled');

    await page.goto(`${baseURL}/admin`, { waitUntil: 'networkidle' });
    await page.getByLabel('Ім’я користувача').fill(username);
    await page.getByLabel('Пароль').fill(password);
    await page.getByRole('button', { name: /Увійти до кабінету/ }).click();
    await page.getByRole('navigation', { name: 'Розділи адмінпанелі' }).waitFor();
    // Seed data is all published; mount a non-interactive sample badge so the muted state is measured too.
    await page.evaluate(() => {
      const badge = document.createElement('span');
      badge.className = 'admin-chip muted';
      badge.textContent = 'Приховано';
      document.querySelector('.admin-shell')?.append(badge);
    });
    await assertTextContrast(page, ['.admin-order', '.admin-nav-item > span', '.admin-chip.muted'], 'admin');

    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Зупинити анімації' }).click();
    assert.equal(await page.locator('html').getAttribute('data-motion-paused'), 'true', 'animation control pauses ambient motion');
    const pausedDuration = await page.locator('.kinetic-line').first().evaluate((element) => getComputedStyle(element).animationDuration);
    assert.ok(pausedDuration.split(',').every((duration) => Number.parseFloat(duration) === 0), `pause control stops animations (got ${pausedDuration})`);
    await page.getByRole('button', { name: 'Відновити анімації' }).click();
    assert.equal(await page.locator('html').getAttribute('data-motion-paused'), 'false', 'animation control can resume motion');
    const resumedDuration = await page.locator('.kinetic-line').first().evaluate((element) => getComputedStyle(element).animationDuration);
    assert.ok(resumedDuration.split(',').some((duration) => Number.parseFloat(duration) > 0), `resume control restores animations (got ${resumedDuration})`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const animationDuration = await page.locator('.kinetic-line').first().evaluate((element) => getComputedStyle(element).animationDuration);
    assert.ok(animationDuration.split(',').every((duration) => Number.parseFloat(duration) === 0), `reduced-motion disables CSS animation (got ${animationDuration})`);
    assert.deepEqual(pageErrors, [], `no browser errors: ${pageErrors.join('; ')}`);
    console.log(JSON.stringify({
      status: 'passed',
      checks: [
        'skip-link focus', 'mobile menu first-link focus, Escape return, 24px targets, and 3:1 focus ring',
        'image alt attributes', 'public/admin/cookie text contrast >= 4.5:1',
        'reject/persist/reload, no pre-consent Google request, consent-gated map, and revocation',
        'motion pause/resume and prefers-reduced-motion',
        'no horizontal overflow at 390px on home, contacts, and legal pages',
      ],
      pages: ['/', '/services', '/team', '/contacts', '/admin', '/privacy', '/terms', '/cookies', '/licenses'],
      screenshots: ['verification/accessibility/home-cookie-banner-390.png', 'verification/accessibility/contacts-map-placeholder-390.png'],
      isolatedData: true,
    }, null, 2));
    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopServer(child);
    await rm(dataDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
