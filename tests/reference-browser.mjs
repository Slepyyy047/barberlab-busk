import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:3000';
const dir = 'verification/work/reference';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { viewports: [], checks: [], errors: [] };
try {
  for (const width of [360, 390, 497, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const order = await page.locator('main > section[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.ok(order.indexOf('services') > order.indexOf('team'));
    assert.equal(await page.locator('.home-person').count(), 5);
    assert.equal(await page.locator('.tool-field img').count(), 15);
    assert.equal(await page.locator('header a[href="/gallery"], header a[href="/about"]').count(), 0);
    const moving = await page.locator('.kinetic-line').evaluate(async node => {
      node.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 150));
      const before = getComputedStyle(node).transform;
      await new Promise(resolve => setTimeout(resolve, 150));
      return before !== getComputedStyle(node).transform;
    });
    assert.ok(moving, 'marquee moves without pointer input');
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const header = await page.locator('header').boundingBox();
    assert.ok(header.y >= 0 && header.y < 2, 'navigation remains visible after scrolling');
    if (width <= 780) {
      const cards = await page.locator('.home-person').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { x: box.x, width: box.width };
      }));
      assert.ok(Math.abs(cards[4].x + cards[4].width / 2 - width / 2) < 2, 'last staff card centered');
      await page.locator('.menu-toggle').click();
    }
    await page.locator('#primary-nav').getByRole('link', { name: 'Послуги', exact: true }).click();
    await page.waitForURL('**/#services');
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#primary-nav a[href="/#services"]').getAttribute('aria-current'), 'location');
    assert.ok((await page.locator('#services').boundingBox()).y >= (await page.locator('header').boundingBox()).height - 2, 'anchor clears header');
    if (width <= 780) assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 500) {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(70);
    }
    await page.waitForTimeout(1000);
    const broken = await page.locator('main img').evaluateAll(nodes => nodes.filter(node => !node.complete || !node.naturalWidth).map(node => node.currentSrc));
    assert.deepEqual(broken, [], 'all visible and lazy-loaded assets load');
    assert.equal(await page.locator('[data-reveal].reveal-pending').count(), 0, 'all scroll reveals are reachable');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#primary-nav [aria-current]').count(), 0, 'section highlight clears at hero');
    await page.screenshot({ path: `${dir}/home-${width}.png` });
    if (width === 390 || width === 1440) await page.screenshot({ path: `${dir}/home-${width}-full.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const animations = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);
    assert.equal(animations, 0, 'reduced motion stops animations');
    report.viewports.push({ width, order, tools: 15, stickyHeader: true, anchors: true, images: 'loaded', reducedMotion: true });
    await page.close();
  }
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  for (const [route, destination] of [['/about', '/#experience'], ['/gallery', '/#team']]) {
    await page.goto(origin + route);
    await page.waitForURL(origin + destination);
    report.checks.push(`${route} redirects to ${destination}`);
  }
  await page.goto(origin + '/services');
  for (const button of await page.locator('.filter-buttons button').all()) {
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('.service-row').count());
  }
  report.checks.push('service filters');
  await page.close();
  assert.deepEqual(report.errors, []);
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
