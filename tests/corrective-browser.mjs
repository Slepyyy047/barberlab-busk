import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const origin = (process.env.BARBERLAB_TEST_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const isolated = process.env.BARBERLAB_ISOLATED === '1';
const outputDir = path.join(process.cwd(), 'verification', 'work');
const proofPath = (name) => path.join(outputDir, `${isolated ? 'corrective-isolated' : 'corrective'}-${name}`);
const report = { origin, isolated, routes: [], checks: [], errors: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });

function record(name, detail = {}) { report.checks.push({ name, ...detail }); }
async function openRoutes(page, mobile = false) {
  for (const route of ['/', '/services', '/team', '/gallery', '/about', '/contacts', '/admin']) {
    const response = await page.goto(`${origin}${route}`);
    assert.equal(response?.status(), 200, `${mobile ? 'mobile ' : ''}${route} direct load`);
    await page.locator('h1').waitFor();
    const refreshed = await page.reload();
    assert.equal(refreshed?.status(), 200, `${route} refresh`);
    await page.locator('h1').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} horizontal overflow`);
    assert.equal(await page.locator('img').evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).length), 0, `${route} broken image`);
    report.routes.push({ route, viewport: mobile ? 'mobile' : 'desktop', status: response.status(), refreshed: true });
  }
}

try {
  await mkdir(outputDir, { recursive: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on('pageerror', (error) => report.errors.push(error.message));
  await openRoutes(desktop);

  await desktop.goto(`${origin}/`);
  await desktop.evaluate(() => document.fonts.ready);
  const firstViewport = await desktop.evaluate(() => ({
    portraits: [...document.querySelectorAll('img')].filter((img) => /Ігор Павлів|Роман Падус|Андрій|Надя|Ілля/.test(img.alt) && img.getBoundingClientRect().top < innerHeight).length,
    mainHeight: document.documentElement.scrollHeight,
    heading: document.querySelector('h1')?.innerText,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(firstViewport.portraits, 0, 'homepage first viewport contains no staff portraits');
  assert.equal(firstViewport.overflow, false);
  const destinations = await desktop.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean));
  assert.ok(destinations.some((href) => href.startsWith('https://b355607.alteg.io/')), 'homepage preserves the configured Altegio destination');
  assert.ok(destinations.some((href) => href === 'tel:+380684040130'), 'homepage preserves the configured phone destination');
  assert.ok(destinations.some((href) => href.includes('instagram.com/barberlab.busk')), 'homepage retains the salon social link');
  await desktop.screenshot({ path: proofPath('home-desktop.png') });
  record('compact homepage first viewport', firstViewport);
  const revealPasses = await desktop.evaluate(async () => {
    const scrollPass = async (direction) => {
      const step = Math.max(260, Math.floor(innerHeight * 0.62));
      const limit = document.documentElement.scrollHeight - innerHeight;
      for (let position = direction > 0 ? 0 : limit; direction > 0 ? position <= limit : position >= 0; position += direction * step) {
        scrollTo({ top: Math.max(0, Math.min(limit, position)), behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 55));
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    };
    await scrollPass(1);
    await scrollPass(-1);
    await scrollPass(1);
    const elements = [...document.querySelectorAll('[data-reveal]')];
    return { count: elements.length, visible: elements.filter((element) => element.classList.contains('is-visible') && Number.parseFloat(getComputedStyle(element).opacity) >= 0.99).length, pending: elements.filter((element) => !element.classList.contains('is-visible') || Number.parseFloat(getComputedStyle(element).opacity) < 0.99).map((element) => `${element.tagName}.${element.className}:${element.textContent?.trim().slice(0, 60)}`) };
  });
  assert.ok(revealPasses.count > 0 && revealPasses.visible === revealPasses.count, `repeated down/up scroll does not leave reveals stuck (${JSON.stringify(revealPasses)})`);
  await desktop.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await desktop.waitForTimeout(500);
  await desktop.screenshot({ path: proofPath('home-desktop-full.png'), fullPage: true });
  record('scroll down, up, and down again', revealPasses);

  await desktop.goto(`${origin}/services`);
  const admin = isolated ? await desktop.context().request : null;
  let original;
  let fixtureSrc;
  if (isolated) {
    const username = process.env.BARBERLAB_ADMIN_USER;
    const password = process.env.BARBERLAB_ADMIN_PASSWORD;
    const login = await admin.post(`${origin}/api/admin/login`, { data: { username, password }, headers: { origin } });
    assert.equal(login.status(), 200, 'isolated CMS user can sign in');
    const response = await admin.get(`${origin}/api/admin/content`);
    assert.equal(response.status(), 200);
    original = await response.json();
    const fixtureBytes = await (await import('node:fs/promises')).readFile(path.join(process.cwd(), 'public', 'logo-source.png'));
    const form = new FormData();
    form.append('file', new Blob([fixtureBytes], { type: 'image/png' }), 'qa-portrait-and-gallery.png');
    const upload = await admin.post(`${origin}/api/admin/upload`, { multipart: form, headers: { origin } });
    assert.equal(upload.status(), 201, `isolated image fixture upload: ${await upload.text()}`);
    fixtureSrc = (await upload.json()).src;
  }

  const readRows = async () => desktop.locator('.service-row h3').allTextContents();
  const filters = desktop.locator('.filter-buttons button');
  const allLabel = 'Усі послуги';
  const labels = await filters.allTextContents();
  assert.ok(labels.includes(allLabel), 'all-services filter exists');
  const allNames = await readRows();
  assert.ok(allNames.length > 0, 'all published services appear by default');
  const services = original?.services ?? [];
  if (isolated) {
    for (const label of labels.filter((item) => item.trim() !== allLabel)) {
      await desktop.getByRole('button', { name: label.trim(), exact: true }).click();
      const expected = services.filter((service) => service.visible && service.category.trim() === label.trim()).map((service) => service.name);
      assert.deepEqual((await readRows()).map((name) => name.trim()), expected, `filter ${label} lists exactly matching published services`);
    }
  } else {
    for (const label of labels.filter((item) => item.trim() !== allLabel)) {
      await desktop.getByRole('button', { name: label.trim(), exact: true }).click();
      assert.ok((await readRows()).length > 0, `${label} results remain visible`);
    }
  }
  const buttons = await filters.all();
  for (let i = 0; i < 30; i += 1) await buttons[(i % Math.max(1, buttons.length))].click({ timeout: 3000 });
  await desktop.getByRole('button', { name: allLabel, exact: true }).click();
  assert.equal((await readRows()).length, allNames.length, 'returning to all restores the full published list after rapid switching');
  assert.ok(await desktop.locator('.service-row strong').count() > 0, 'service prices remain visible');
  assert.ok(await desktop.locator('.service-book').count() > 0, 'service booking links remain present');
  await desktop.screenshot({ path: proofPath('services-desktop.png'), fullPage: true });
  record('service filters desktop', { labels: labels.map((label) => label.trim()), countAll: allNames.length, rapidSwitches: 30 });

  if (isolated) {
    const save = async (content) => {
      const response = await admin.put(`${origin}/api/admin/content`, { data: content, headers: { origin } });
      assert.equal(response.status(), 200, `isolated CMS save: ${response.status()} ${await response.text()}`);
      return (await response.json()).content;
    };
    assert.ok(services.length > 0, 'isolated seed supplies services');
    const changed = structuredClone(original);
    changed.services[0].category = 'Стрижки';
    changed.services[0].price = 98765;
    const hidden = changed.services.find((service) => service.visible && service.id !== changed.services[0].id);
    if (hidden) hidden.visible = false;
    const saved = await save(changed);
    await desktop.goto(`${origin}/services`);
    const changedRow = desktop.locator('.service-row').filter({ has: desktop.getByRole('heading', { name: saved.services[0].name, exact: true }) });
    await changedRow.waitFor();
    assert.match(await changedRow.innerText(), /98\s?765|98765/, 'CMS price change propagates to public services');
    await desktop.getByRole('button', { name: 'Стрижки', exact: true }).click();
    const expectedCuts = saved.services.filter((service) => service.visible && service.category.trim() === 'Стрижки').map((service) => service.name).sort();
    assert.deepEqual((await readRows()).map((name) => name.trim()).sort(), expectedCuts, 'CMS category change propagates into category filtering');
    record('isolated CMS service category, visibility, and price edit', { changedService: saved.services[0].name, price: 98765, category: 'Стрижки' });

    // Keep a hidden record carrying a category label to exercise a truly empty selection if exposed.
    const emptyCategory = structuredClone(saved);
    const categoryCarrier = emptyCategory.services.find((service) => !service.visible) ?? emptyCategory.services[0];
    categoryCarrier.category = 'QA порожня категорія';
    categoryCarrier.visible = false;
    await save(emptyCategory);
    await desktop.goto(`${origin}/services`);
    const emptyButton = desktop.getByRole('button', { name: 'QA порожня категорія', exact: true });
    if (await emptyButton.count()) {
      await emptyButton.click();
      assert.equal(await desktop.locator('.service-row').count(), 0, 'empty category has no stale service results');
      assert.ok(await desktop.getByRole('status').count(), 'empty category explains the absence of published services');
      record('empty category state', { exposed: true });
    } else {
      record('empty category state', { exposed: false, reason: 'Category options contain only categories with published services.' });
    }

    const setStaff = async (count, missingPortrait = false) => {
      const content = structuredClone(original);
      content.staff = content.staff.slice(0, count).map((person, index) => ({ ...person, visible: true, order: index, portrait: missingPortrait && index === count - 1 ? null : index === 0 ? fixtureSrc : null }));
      await save(content);
      await desktop.goto(`${origin}/team`);
      const cards = desktop.locator('.team-card');
      assert.equal(await cards.count(), count, `team shows exactly ${count} visible staff`);
      const widths = await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
      if (count === 1) assert.ok(widths[0] < desktop.viewportSize().width * 0.75, 'single employee card does not stretch across the page');
      if (missingPortrait) {
        const portraitFrame = cards.nth(count - 1).locator('.team-portrait');
        const frame = await portraitFrame.boundingBox();
        assert.ok(frame && frame.height <= 170, 'missing portrait uses a compact text treatment');
        assert.ok(await portraitFrame.innerText().then((text) => text.trim().length > 0), 'missing portrait has intentional fallback text');
      }
      return widths;
    };
    const teamLayouts = {};
    for (const count of [1, 2, 5]) teamLayouts[count] = await setStaff(count, count === 2);
    await desktop.waitForFunction(() => [...document.querySelectorAll('.team-card img')].every((image) => image.complete && image.naturalWidth > 0));
    await desktop.screenshot({ path: proofPath('team-desktop.png'), fullPage: true });
    const firstPortrait = desktop.locator('.team-card img').first();
    if (await firstPortrait.count()) {
      const before = await desktop.locator('.team-card').first().locator('.team-portrait').boundingBox();
      const initialImageTransform = await firstPortrait.evaluate((image) => getComputedStyle(image).transform);
      const neighborBefore = await desktop.locator('.team-card').nth(1).boundingBox();
      const scrollBefore = await desktop.evaluate(() => scrollY);
      const bookingLink = desktop.locator('.team-card').first().getByRole('link');
      await bookingLink.focus();
      assert.equal(await bookingLink.evaluate((element) => element === document.activeElement), true, 'team booking link is keyboard focusable');
      await desktop.locator('.team-card').first().hover();
      await desktop.waitForTimeout(350);
      const after = await desktop.locator('.team-card').first().locator('.team-portrait').boundingBox();
      const hoverImageTransform = await firstPortrait.evaluate((image) => getComputedStyle(image).transform);
      const neighborAfter = await desktop.locator('.team-card').nth(1).boundingBox();
      const scrollAfter = await desktop.evaluate(() => scrollY);
      assert.ok(before && after && Math.abs(after.width - before.width) < 0.5 && Math.abs(after.height - before.height) < 0.5, 'portrait zoom stays within a fixed frame');
      assert.notEqual(hoverImageTransform, initialImageTransform, 'portrait has a visible hover zoom interaction');
      if (neighborBefore && neighborAfter) assert.ok(Math.abs(neighborAfter.x - neighborBefore.x) < 1 && Math.abs(neighborAfter.y + scrollAfter - neighborBefore.y - scrollBefore) < 1, 'portrait hover does not shift adjacent cards in document coordinates');
    }
    record('responsive team counts and missing portrait', { widths: teamLayouts });

    // Public gallery is hidden temporarily; its CMS content must remain intact.
    const src = fixtureSrc;
    const galleryContent = structuredClone(original);
    galleryContent.staff = original.staff;
    galleryContent.gallery = [{ id: 'qa-gallery-fixture', src, alt: 'QA тимчасове фото', category: 'QA', visible: true, order: 0 }];
    await save(galleryContent);
    await desktop.goto(`${origin}/gallery`);
    await desktop.waitForURL(`${origin}/#team`);
    const retainedResponse = await admin.get(`${origin}/api/admin/content`);
    const retained = await retainedResponse.json();
    assert.ok(retained.gallery.some(image => image.src === src), 'gallery redirect preserves CMS media');
    const deleteFixture = await admin.delete(`${origin}/api/admin/upload`, { data: { src }, headers: { origin } });
    assert.ok(deleteFixture.status() === 200 || deleteFixture.status() === 404, 'isolated gallery upload is removed');
    record('hidden gallery retains CMS content and fixture cleanup', { fixtureRemoved: deleteFixture.status() === 200 });
    await save(original);
  }

  if (!isolated) {
    await desktop.goto(`${origin}/team`);
    const publicCards = desktop.locator('.team-card');
    const publicCardCount = await publicCards.count();
    assert.equal(publicCardCount, 5, 'owner data retains all five staff records');
    assert.equal(await publicCards.locator('img').count(), publicCardCount, 'owner team page displays the five real CMS portraits');
    await desktop.waitForFunction(() => [...document.querySelectorAll('.team-card img')].every((image) => image.complete && image.naturalWidth > 0));
    await desktop.locator('.team-card').first().locator('.team-portrait').hover();
    await desktop.waitForTimeout(350);
    await desktop.mouse.move(0, 0);
    await desktop.waitForTimeout(400);
    await desktop.screenshot({ path: proofPath('team-desktop.png'), fullPage: true });
    record('public team composition and portraits', { visibleStaff: publicCardCount, realPortraits: await publicCards.locator('img').count() });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (error) => report.errors.push(error.message));
  await openRoutes(mobile, true);
  await mobile.goto(`${origin}/`);
  for (let index = 0; index < 4; index += 1) {
    const open = mobile.getByRole('button', { name: 'Відкрити меню' });
    if (await open.count()) await open.click();
    const close = mobile.getByRole('button', { name: 'Закрити меню' });
    if (await close.count()) await close.click();
  }
  await mobile.goto(`${origin}/services`);
  const mobileFilters = mobile.locator('.filter-buttons button');
  const mobileLabels = await mobileFilters.allTextContents();
  for (const label of mobileLabels.slice(1)) await mobile.getByRole('button', { name: label.trim(), exact: true }).tap();
  await mobile.getByRole('button', { name: 'Усі послуги', exact: true }).tap();
  assert.ok(await mobile.locator('.service-row').count() > 0, 'touch filtering restores all services');
  await mobile.mouse.move(0, 0);
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: proofPath('services-mobile.png'), fullPage: true });
  await mobile.goto(`${origin}/team`);
  await mobile.waitForFunction(() => [...document.querySelectorAll('.team-card img')].every((image) => image.complete && image.naturalWidth > 0));
  await mobile.screenshot({ path: proofPath('team-mobile.png'), fullPage: true });
  record('mobile navigation, touch filters, and screenshots', { menuCycles: 4, filterLabels: mobileLabels.map((label) => label.trim()) });

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', javaScriptEnabled: false });
  const reducedResponse = await reduced.goto(`${origin}/`);
  assert.equal(reducedResponse?.status(), 200);
  const reducedState = await reduced.evaluate(() => ({ headingVisible: Boolean(document.querySelector('h1')?.getBoundingClientRect().height), hiddenElements: [...document.querySelectorAll('[data-reveal]')].filter((item) => Number.parseFloat(getComputedStyle(item).opacity) < 0.99).length, overflow: document.documentElement.scrollWidth > innerWidth }));
  assert.equal(reducedState.headingVisible, true);
  assert.equal(reducedState.hiddenElements, 0, 'no-JS and reduced-motion content is immediately visible');
  assert.equal(reducedState.overflow, false);
  await reduced.screenshot({ path: proofPath('reduced-mobile.png') });
  record('reduced motion and no JavaScript', reducedState);
  const reducedJs = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await reducedJs.goto(`${origin}/`);
  await reducedJs.waitForTimeout(100);
  const reducedJsState = await reducedJs.evaluate(() => ({ hidden: [...document.querySelectorAll('[data-reveal]')].filter((item) => Number.parseFloat(getComputedStyle(item).opacity) < 0.99).length, transform: [...document.querySelectorAll('[data-parallax], [data-hero-motion]')].map((item) => getComputedStyle(item).transform).filter((value) => value !== 'none') }));
  assert.equal(reducedJsState.hidden, 0, 'reduced-motion keeps reveal content immediately visible');
  assert.equal(reducedJsState.transform.length, 0, 'reduced-motion disables parallax and hero transforms');
  record('reduced motion with JavaScript', reducedJsState);
  const motionFailure = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await motionFailure.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: class { constructor() { throw new Error('simulated observer initialization failure'); } } });
  });
  await motionFailure.goto(`${origin}/`);
  await motionFailure.waitForTimeout(100);
  const failureFallback = await motionFailure.evaluate(() => ({ total: document.querySelectorAll('[data-reveal]').length, visible: [...document.querySelectorAll('[data-reveal]')].filter((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.99).length, motionReady: document.documentElement.classList.contains('motion-ready') }));
  assert.ok(failureFallback.total > 0 && failureFallback.visible === failureFallback.total, 'failed motion initialization leaves all content visible');
  assert.equal(failureFallback.motionReady, false, 'failed motion initialization does not activate hidden-state styling');
  record('animation initialization failure fallback', failureFallback);
  await motionFailure.close();

  const performancePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const responseSizes = [];
  performancePage.on('response', (response) => {
    const size = Number(response.headers()['content-length']);
    if (Number.isFinite(size)) responseSizes.push(size);
  });
  await performancePage.goto(origin, { waitUntil: 'networkidle' });
  const homePerformance = await performancePage.evaluate(async () => {
    let longTaskCount = 0;
    let cls = 0;
    const longTasks = new PerformanceObserver((list) => { longTaskCount += list.getEntries().length; });
    try { longTasks.observe({ type: 'longtask', buffered: true }); } catch { /* browser may not expose Long Tasks */ }
    const shifts = new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) cls += entry.value; });
    try { shifts.observe({ type: 'layout-shift', buffered: true }); } catch { /* browser may not expose Layout Shift */ }
    const step = Math.max(220, Math.floor(innerHeight * 0.45));
    const frameIntervals = [];
    let prior;
    for (let target = 0; target < document.documentElement.scrollHeight; target += step) {
      scrollTo({ top: target, behavior: 'instant' });
      const stamp = await new Promise((resolve) => requestAnimationFrame((time) => requestAnimationFrame(() => resolve(time))));
      if (prior !== undefined) frameIntervals.push(stamp - prior);
      prior = stamp;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    longTasks.disconnect(); shifts.disconnect();
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map((entry) => ({ type: entry.initiatorType, path: new URL(entry.name).pathname, transferBytes: entry.transferSize, encodedBodyBytes: entry.encodedBodySize }));
    const sorted = [...frameIntervals].sort((a, b) => a - b);
    return { viewport: { width: innerWidth, height: innerHeight }, documentHeight: document.documentElement.scrollHeight, navigation: { responseEndMs: navigation?.responseEnd, domContentLoadedMs: navigation?.domContentLoadedEventEnd, loadMs: navigation?.loadEventEnd }, paints: Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime])), resources: { count: resources.length, browserTransferBytes: resources.reduce((sum, entry) => sum + entry.transferBytes, 0), encodedBodyBytes: resources.reduce((sum, entry) => sum + entry.encodedBodyBytes, 0), knownSizeCount: resources.filter((entry) => entry.transferBytes > 0).length, images: resources.filter((entry) => /\.(?:png|jpe?g|webp|avif|svg)$/i.test(entry.path)).length, fonts: resources.filter((entry) => /\.(?:woff2?|ttf|otf)$/i.test(entry.path)).length, entries: resources }, scroll: { observedFrameIntervals: frameIntervals.length, medianRafIntervalMs: sorted[Math.floor(sorted.length / 2)] ?? null, maxRafIntervalMs: Math.max(0, ...frameIntervals), longTaskCount, observedCls: Number(cls.toFixed(4)) } };
  });
  homePerformance.resources.contentLengthBytes = responseSizes.reduce((sum, value) => sum + value, 0);
  await performancePage.goto(`${origin}/team`, { waitUntil: 'networkidle' });
  homePerformance.teamPageHeight = await performancePage.evaluate(() => document.documentElement.scrollHeight);
  const baseline = JSON.parse(await readFile(path.join(outputDir, 'corrective-baseline.json'), 'utf8'));
  const performanceComparison = { note: 'Single-run local browser observations at the same 1440×900 viewport and one automated downward scroll; not a benchmark claim. Resource byte fields use separate browser and Content-Length observations and are reported raw without a cross-method delta.', baseline, final: homePerformance, differences: { homepageHeightPx: homePerformance.documentHeight - baseline.height.documentHeight, resourceCount: homePerformance.resources.count - baseline.resources.count, imageCount: homePerformance.resources.images, fontCount: homePerformance.resources.fonts } };
  report.performance = performanceComparison;
  record('production browser observations compared with baseline', { viewport: homePerformance.viewport, homepageHeightPx: homePerformance.documentHeight, baselineHomepageHeightPx: baseline.height.documentHeight, resources: homePerformance.resources.count, byteObservations: homePerformance.resources, longTaskCount: homePerformance.scroll.longTaskCount, observedCls: homePerformance.scroll.observedCls });
  await writeFile(proofPath('performance-comparison.json'), `${JSON.stringify(performanceComparison, null, 2)}\n`);
  await performancePage.close();
  assert.deepEqual(report.errors, [], `uncaught browser errors: ${report.errors.join('; ')}`);
  await writeFile(proofPath('browser-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
