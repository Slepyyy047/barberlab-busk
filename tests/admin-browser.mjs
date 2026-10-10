import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = (process.env.BARBERLAB_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const repoRoot = process.cwd();
const artifactDir = path.join(repoRoot, 'verification');
const username = `e2e-admin-${Date.now()}-${randomBytes(3).toString('hex')}`;
const password = `Test-${randomBytes(24).toString('base64url')}-9a!`;
const result = { target: baseURL, startedAt: new Date().toISOString(), status: 'running', steps: [], screenshots: [], uploadedFixture: 'public/logo-source.png (temporary UI upload fixture; not a business photo)', cleanup: {} };
let browser;
let context;
let page;
let originalContent;
let csrfToken;
let accountCreated = false;
let loggedIn = false;
const uploadedSources = new Set();
const deletedSources = new Set();
const pageErrors = [];

function record(name, details = {}) { result.steps.push({ name, status: 'passed', ...details }); }
function provisionAccount() {
  const source = "import { provisionAdmin } from './lib/auth.ts'; provisionAdmin(process.env.BARBERLAB_ADMIN_USER, process.env.BARBERLAB_ADMIN_PASSWORD);";
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: repoRoot, encoding: 'utf8', env: { ...process.env, BARBERLAB_ADMIN_USER: username, BARBERLAB_ADMIN_PASSWORD: password },
  });
  if (run.status !== 0) throw new Error(`Could not provision disposable E2E account: ${run.stderr || run.stdout}`);
  accountCreated = true;
}
function removeAccount() {
  if (!accountCreated) return;
  const source = "import { getDatabase } from './lib/store.ts'; const db=getDatabase(); db.exec('PRAGMA busy_timeout=5000'); db.prepare('DELETE FROM sessions WHERE username=?').run(process.env.BARBERLAB_ADMIN_USER); db.prepare('DELETE FROM admins WHERE username=?').run(process.env.BARBERLAB_ADMIN_USER);";
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: repoRoot, encoding: 'utf8', env: { ...process.env, BARBERLAB_ADMIN_USER: username },
  });
  if (run.status !== 0) throw new Error(`Could not remove disposable E2E account: ${run.stderr || run.stdout}`);
  result.cleanup.accountAndSessionsRemoved = true;
}
async function saveContent() {
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/content') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: /Зберегти зміни/ }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, `Content save failed: ${response.status()} ${await response.text()}`);
  await page.getByRole('status').filter({ hasText: 'Зміни збережено.' }).waitFor();
  return response.json();
}
async function readServerContent() {
  const response = await context.request.get(`${baseURL}/api/admin/content`);
  assert.equal(response.status(), 200, 'Authenticated content endpoint should respond successfully');
  return response.json();
}

try {
  await mkdir(artifactDir, { recursive: true });
  provisionAccount();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: false });
  page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', async (response) => {
    if (response.url().endsWith('/api/admin/upload') && response.request().method() === 'POST' && response.status() === 201) {
      try { uploadedSources.add((await response.json()).src); } catch { /* test assertion will catch missing uploads */ }
    }
  });

  const loginResponse = await page.goto(`${baseURL}/admin`);
  assert.equal(loginResponse?.status(), 200, 'Admin route should return HTTP 200');
  await page.getByLabel('Ім’я користувача').fill(username);
  await page.getByLabel('Пароль').fill(password);
  const loginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Увійти до кабінету/ }).click();
  const loginResult = await loginResponsePromise;
  assert.equal(loginResult.status(), 200, 'Disposable account login should succeed');
  await page.getByRole('navigation', { name: 'Розділи адмінпанелі' }).waitFor();
  const sessionResponse = await context.request.get(`${baseURL}/api/admin/session`);
  const sessionData = await sessionResponse.json();
  assert.equal(sessionData.authenticated, true, 'Admin session should be active');
  assert.match(sessionData.csrfToken, /^[A-Za-z0-9_-]{43}$/, 'Authenticated session exposes a CSRF token');
  csrfToken = sessionData.csrfToken;
  loggedIn = true;
  originalContent = await readServerContent();
  await writeFile(path.join(artifactDir, 'admin-e2e-snapshot.json'), JSON.stringify(originalContent, null, 2), 'utf8');
  record('admin login and authenticated session', { contentCounts: { services: originalContent.services.length, staff: originalContent.staff.length, gallery: originalContent.gallery.length } });

  const desktopShot = path.join(artifactDir, 'admin-desktop.png');
  await page.screenshot({ path: desktopShot, fullPage: true });
  result.screenshots.push(path.relative(repoRoot, desktopShot).replaceAll('\\', '/'));
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  assert.ok(overflow.document <= overflow.viewport, `CMS overflows at 360px: ${JSON.stringify(overflow)}`);
  const mobileShot = path.join(artifactDir, 'admin-mobile.png');
  await page.screenshot({ path: mobileShot, fullPage: true });
  result.screenshots.push(path.relative(repoRoot, mobileShot).replaceAll('\\', '/'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  record('CMS desktop and 360px layout', { mobileDocumentWidth: overflow.document, mobileViewportWidth: overflow.viewport });

  assert.ok(originalContent.services.length > 0, 'Seed content must include a service for edit verification');
  const firstService = originalContent.services[0];
  const changedPrice = firstService.price + 17;
  await page.locator('.admin-card').first().getByLabel('Ціна, ₴').fill(String(changedPrice));
  await saveContent();
  await page.goto(`${baseURL}/services`);
  const publicService = page.locator('.service-row').filter({ hasText: firstService.name }).first();
  await publicService.waitFor();
  assert.ok((await publicService.innerText()).includes(new Intl.NumberFormat('uk-UA').format(changedPrice)), 'Saved service price should be visible on the public services page');
  record('edit service price and verify public listing', { service: firstService.name, price: changedPrice });

  await page.goto(`${baseURL}/admin`);
  const createdName = 'QA E2E тимчасова послуга';
  await page.getByRole('button', { name: /Послуги/ }).click();
  await page.getByRole('button', { name: /Додати послугу/ }).click();
  let cards = page.locator('.admin-card');
  const createdCard = cards.last();
  await createdCard.getByLabel('Назва').fill(createdName);
  await createdCard.getByLabel('Категорія').fill('E2E тест');
  await createdCard.getByLabel('Ціна, ₴').fill('321');
  await createdCard.getByLabel('Тривалість, хв').fill('30');
  await page.getByRole('button', { name: `Перемістити ${createdName} вгору` }).click();
  let savedEnvelope = await saveContent();
  let savedContent = savedEnvelope.content;
  const createdSaved = savedContent.services.find((service) => service.name === createdName);
  assert.ok(createdSaved, 'New service should persist');
  assert.equal(createdSaved.order, originalContent.services.length - 1, 'One move-up should place the new service immediately before the former last item');
  const orderedSavedServices = [...savedContent.services].sort((a, b) => a.order - b.order);
  assert.equal(orderedSavedServices.at(-2)?.id, createdSaved.id, 'Moved service should be second-to-last in editor order');
  assert.equal(orderedSavedServices.at(-1)?.id, originalContent.services.at(-1)?.id, 'Former last service should remain directly after the moved service');
  await page.goto(`${baseURL}/services`);
  let publicNames = await page.locator('.service-row h3').allTextContents();
  assert.ok(publicNames.includes(createdName), 'New visible service should appear publicly');
  const expectedPublicOrder = savedContent.services.filter((service) => service.visible).sort((a, b) => a.order - b.order).map((service) => service.name);
  assert.deepEqual(publicNames, expectedPublicOrder, 'Public services should follow the saved editor order');

  await page.goto(`${baseURL}/admin`);
  await page.getByRole('button', { name: /Послуги/ }).click();
  cards = page.locator('.admin-card');
  const createdCardAfterSave = cards.filter({ hasText: createdName });
  await createdCardAfterSave.getByLabel('Показувати на сайті').uncheck();
  savedEnvelope = await saveContent();
  savedContent = savedEnvelope.content;
  assert.equal(savedContent.services.find((service) => service.name === createdName).visible, false, 'Hide state should persist');
  await page.goto(`${baseURL}/services`);
  publicNames = await page.locator('.service-row h3').allTextContents();
  assert.ok(!publicNames.includes(createdName), 'Hidden service should no longer appear publicly');
  record('create, reorder, publish, then hide service', { service: createdName, publicOrderVerified: true, hiddenFromPublic: true });

  await page.goto(`${baseURL}/admin`);
  await page.getByRole('button', { name: /Інформація/ }).click();
  const changedPhone = '068 404 0197';
  await page.getByLabel('Телефон', { exact: true }).fill(changedPhone);
  await saveContent();
  await page.goto(`${baseURL}/contacts`);
  await page.locator('#main').getByRole('link', { name: changedPhone, exact: true }).waitFor();
  record('edit contact phone and verify public contact page', { phone: changedPhone });

  await page.goto(`${baseURL}/admin`);
  await page.getByRole('button', { name: /Галерея/ }).click();
  const fixture = await readFile(path.join(repoRoot, 'public', 'logo-source.png'));
  await page.locator('.admin-upload input[type="file"]').setInputFiles([
    { name: 'e2e-fixture-one.png', mimeType: 'image/png', buffer: fixture },
    { name: 'e2e-fixture-two.png', mimeType: 'image/png', buffer: fixture },
  ]);
  await page.getByLabel('Опис фото').nth(0).waitFor();
  await page.waitForFunction((initialCount) => document.querySelectorAll('.admin-gallery-card').length === initialCount + 2, originalContent.gallery.length);
  assert.equal(uploadedSources.size, 2, 'Both UI upload requests should return tracked media paths');
  const firstFixtureIndex = originalContent.gallery.length;
  await page.getByLabel('Опис фото').nth(firstFixtureIndex).fill('QA fixture — перше фото');
  await page.getByLabel('Опис фото').nth(firstFixtureIndex + 1).fill('QA fixture — друге фото');
  await page.getByLabel('Категорія').nth(firstFixtureIndex).fill('QA fixture');
  await page.getByLabel('Категорія').nth(firstFixtureIndex + 1).fill('QA fixture');
  await saveContent();
  await page.goto(`${baseURL}/gallery`);
  await page.waitForURL(`${baseURL}/#team`);
  const retainedGallery = (await readServerContent()).gallery;
  assert.equal(retainedGallery.length, originalContent.gallery.length + 2, 'Hidden public gallery preserves uploaded CMS content');
  record('upload gallery fixtures while public gallery remains hidden', { uploadedFixtureCount: uploadedSources.size, cmsContentRetained: true });

  await page.goto(`${baseURL}/admin`);
  await page.getByRole('button', { name: /Галерея/ }).click();
  const testFirstCard = page.locator('.admin-gallery-card').nth(firstFixtureIndex);
  const removedSrc = await testFirstCard.locator('img').getAttribute('src');
  const deleteResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/upload') && response.request().method() === 'DELETE');
  page.once('dialog', (dialogEvent) => dialogEvent.accept());
  await testFirstCard.getByRole('button', { name: 'Видалити фото' }).click();
  const deleteResponse = await deleteResponsePromise;
  assert.equal(deleteResponse.status(), 200, 'Gallery delete should complete successfully through the admin UI');
  assert.ok(removedSrc && uploadedSources.has(removedSrc), 'The selected test card should reference one of the temporary upload files');
  deletedSources.add(removedSrc);
  assert.equal(await page.locator('.admin-gallery-card').count(), originalContent.gallery.length + 1, 'Deleted fixture should disappear from editor');
  const afterDeleteContent = await readServerContent();
  assert.ok(!afterDeleteContent.gallery.some((image) => image.src === removedSrc), 'Deleted media reference should be absent from server content');
  record('delete gallery photo through confirmed UI action', { deletedPersistedReference: true });

  assert.deepEqual(pageErrors, [], `Browser reported page errors: ${pageErrors.join('; ')}`);
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.stack || error.message : String(error);
} finally {
  try {
    if (context && originalContent && loggedIn) {
      const restore = await context.request.put(`${baseURL}/api/admin/content`, { data: originalContent, headers: { 'content-type': 'application/json', origin: baseURL, 'x-csrf-token': csrfToken } });
      result.cleanup.contentRestoredInitial = restore.status() === 200;
      if (restore.status() !== 200) result.cleanup.restoreError = `${restore.status()} ${await restore.text()}`;
      for (const src of uploadedSources) {
        if (deletedSources.has(src)) continue;
        const removed = await context.request.delete(`${baseURL}/api/admin/upload`, { data: { src }, headers: { 'content-type': 'application/json', origin: baseURL, 'x-csrf-token': csrfToken } });
        if (removed.status() === 200 || removed.status() === 404) deletedSources.add(src);
        else result.cleanup.mediaErrors = [...(result.cleanup.mediaErrors || []), `${src}: ${removed.status()} ${await removed.text()}`];
      }
      const restoreAgain = await context.request.put(`${baseURL}/api/admin/content`, { data: originalContent, headers: { 'content-type': 'application/json', origin: baseURL, 'x-csrf-token': csrfToken } });
      result.cleanup.contentRestoredAfterMediaCleanup = restoreAgain.status() === 200;
      if (restoreAgain.status() !== 200) result.cleanup.finalRestoreError = `${restoreAgain.status()} ${await restoreAgain.text()}`;
      if (loggedIn) {
        const logout = await context.request.post(`${baseURL}/api/admin/logout`, { headers: { origin: baseURL, 'x-csrf-token': csrfToken } });
        result.cleanup.sessionRevoked = logout.status() === 200;
      }
    }
  } catch (cleanupError) {
    result.cleanup.error = cleanupError instanceof Error ? cleanupError.stack || cleanupError.message : String(cleanupError);
    result.status = 'failed';
  }
  try { if (context) await context.close(); } catch { /* best-effort browser cleanup */ }
  try { if (browser) await browser.close(); } catch { /* best-effort browser cleanup */ }
  try { removeAccount(); } catch (cleanupError) { result.cleanup.accountError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError); result.status = 'failed'; }
  result.cleanup.uploadedFixtureMediaCount = uploadedSources.size;
  result.cleanup.fixtureMediaRemoved = [...uploadedSources].every((src) => deletedSources.has(src));
  if (result.cleanup.contentRestoredAfterMediaCleanup && result.cleanup.fixtureMediaRemoved) {
    await unlink(path.join(artifactDir, 'admin-e2e-snapshot.json')).catch(() => {});
    result.cleanup.recoverySnapshotRemoved = true;
  } else if (originalContent) {
    result.cleanup.recoverySnapshot = 'verification/admin-e2e-snapshot.json';
  }
  result.finishedAt = new Date().toISOString();
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'admin-e2e.json'), JSON.stringify(result, null, 2), 'utf8');
}

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'passed' || result.cleanup.contentRestoredInitial !== true || result.cleanup.contentRestoredAfterMediaCleanup !== true || result.cleanup.accountAndSessionsRemoved !== true || result.cleanup.fixtureMediaRemoved !== true) process.exitCode = 1;

