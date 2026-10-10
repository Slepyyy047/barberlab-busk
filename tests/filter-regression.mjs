import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';

const normalize = (text) => text.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let db;
let initialContent;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.env.BARBERLAB_TEST_URL ?? 'http://127.0.0.1:3000/services', { waitUntil: 'networkidle' });

  const labels = (await page.locator('.filter-buttons button').allTextContents()).map((label) => label.trim());
  const allLabel = 'Усі послуги';
  assert.ok(labels.includes(allLabel), 'all-services option is present');
  const categories = labels.filter((label) => label !== allLabel);
  const expectedByCategory = await page.locator('.service-row').evaluateAll((rows) => rows.reduce((result, row) => {
    const category = row.getAttribute('data-category');
    if (category) {
      const key = category.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA');
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, {}));

  for (const label of [...categories, ...categories.slice().reverse(), allLabel]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${label} exposes pressed state`);
    const result = await page.locator('.service-row').evaluateAll((elements) => elements.map((row) => ({
      category: row.getAttribute('data-category') ? row.getAttribute('data-category').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA') : '',
      opacity: Number.parseFloat(getComputedStyle(row).opacity),
      price: row.querySelector('strong')?.textContent?.trim(),
      duration: row.querySelector('.service-name p')?.textContent?.trim(),
      booking: row.querySelector('.service-book')?.getAttribute('href'),
    })));
    assert.ok(result.every((row) => row.opacity >= 0.99), `${label} results remain visible after filtering`);
    assert.ok(result.every((row) => row.price && row.duration && row.booking), `${label} retains price, duration, and booking`);
    if (label !== allLabel && expectedByCategory[normalize(label)] !== undefined) {
      assert.equal(result.length, expectedByCategory[normalize(label)], `${label} returns exactly its published services`);
      assert.ok(result.every((row) => row.category === normalize(label)), `${label} contains only matching category rows`);
    } else if (label !== allLabel) {
      assert.equal(result.length, 0, `${label} has no published services`);
      assert.match(await page.getByRole('status').textContent(), /поки немає опублікованих послуг/u);
    }
  }

  for (const label of [...categories, ...categories.slice().reverse(), allLabel].flatMap((label) => [label, label])) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${label} remains selected during rapid switching`);
  }
  assert.equal(await page.getByRole('button', { name: allLabel, exact: true }).getAttribute('aria-pressed'), 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of [...categories, allLabel]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${label} filter works at mobile width`);
    assert.ok(await page.locator('.service-row').evaluateAll((rows) => rows.every((row) => Number.parseFloat(getComputedStyle(row).opacity) >= 0.99)), `${label} remains visible at mobile width`);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const label of [...categories, allLabel]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.ok(await page.locator('.service-row').evaluateAll((rows) => rows.every((row) => Number.parseFloat(getComputedStyle(row).opacity) >= 0.99)), `reduced motion keeps ${label} visible`);
  }

  if (process.env.BARBERLAB_TEST_DATA_DIR) {
    db = new DatabaseSync(`${process.env.BARBERLAB_TEST_DATA_DIR}/barberlab.sqlite`);
    const record = db.prepare('SELECT json FROM content WHERE id = 1').get();
    initialContent = String(record.json);
    const content = JSON.parse(initialContent);
    const hiddenOnlyLabel = '  Тестова   порожня категорія  ';
    content.services[0] = { ...content.services[0], visible: false, category: hiddenOnlyLabel };
    db.prepare('UPDATE content SET json = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(content), new Date().toISOString());
    await page.reload({ waitUntil: 'networkidle' });
    const emptyCategoryLabel = hiddenOnlyLabel.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    const emptyButton = page.getByRole('button', { name: emptyCategoryLabel, exact: true });
    await emptyButton.click();
    assert.equal(await emptyButton.getAttribute('aria-pressed'), 'true', 'hidden-only CMS category can be selected');
    assert.equal(await page.locator('.service-row').count(), 0, 'hidden service details remain unpublished');
    assert.match(await page.getByRole('status').textContent(), /поки немає опублікованих послуг/u, 'empty category gives a clear Ukrainian status');
  }

  assert.deepEqual(errors, [], 'no browser errors during category filtering');
  console.log(`Service category regression passed on desktop, mobile, and reduced motion for ${categories.join(', ')}; rapid switching is reliable.${db ? ' Hidden-only CMS category shows the empty state without exposing its service.' : ''}`);
} finally {
  if (db && initialContent) {
    db.prepare('UPDATE content SET json = ?, updated_at = ? WHERE id = 1').run(initialContent, new Date().toISOString());
    db.close();
  }
  await browser.close();
}

