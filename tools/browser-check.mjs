/* Optional development verification. Uses an already installed Playwright only. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { createStudioServer } from '../serve.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = createStudioServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const issues = [];
const external = [];

function monitor(page) {
  page.on('pageerror', error => issues.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith(origin) && !/^(file|data|blob):/.test(request.url())) external.push(request.url());
  });
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function screenshot(page, name) {
  let data;
  for (const quality of [78, 65, 50, 35]) {
    data = await page.screenshot({ type: 'jpeg', quality, fullPage: true, animations: 'disabled' });
    if (data.length <= 256 * 1024) break;
  }
  assert.ok(data.length <= 256 * 1024, `${name} exceeds screenshot budget`);
  await writeFile(path.join(root, 'screenshots', name), data);
  console.log(`Screenshot: ${name} (${data.length} bytes)`);
}
async function downloadPng(page, expectedName) {
  const pending = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), expectedName);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 1500);
  assert.ok(bytes.length > 10000);
  return bytes;
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  monitor(page);
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Your cover is ready'));
  await settle(page);
  const first = await page.locator('#cover').evaluate(canvas => canvas.toDataURL());
  const photoPixels = await page.locator('#cover').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(200, 200, 1, 1).data;
    return [...data];
  });
  assert.equal(photoPixels[3], 255);
  await screenshot(page, '1-cover.jpg');
  const initialPng = await downloadPng(page, 'vice-cover-vice-after-dark.png');

  await page.locator('[data-layout="diagonal"]').click();
  await page.locator('[data-palette="neon"]').click();
  await page.locator('#caption').fill('MIDNIGHT RUN');
  await page.locator('#zoom').fill('145');
  await page.locator('#focus-x').fill('70');
  await page.locator('#intensity').fill('85');
  await settle(page);
  assert.notEqual(await page.locator('#cover').evaluate(canvas => canvas.toDataURL()), first);
  assert.equal(await page.locator('[data-layout="diagonal"]').getAttribute('aria-pressed'), 'true');
  await screenshot(page, '2-editor.jpg');
  const secondPng = await downloadPng(page, 'vice-cover-midnight-run.png');
  assert.notDeepEqual(initialPng, secondPng);

  await page.locator('#photo').setInputFiles(path.join(root, 'app/samples/pier.jpg'));
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Photo loaded'));
  await page.locator('[data-layout="grid"]').click();
  await page.locator('[data-palette="gold"]').click();
  await page.locator('#caption').fill('GOLDEN STATE');
  await page.locator('#tagline').fill('EVERY SUNSET HAS A STORY.');
  await settle(page);
  await screenshot(page, '3-cover.jpg');
  await downloadPng(page, 'vice-cover-golden-state.png');

  // Existing state must still edit and download when the browser is offline.
  await context.setOffline(true);
  await page.locator('#caption').fill('OFF THE GRID');
  await settle(page);
  await downloadPng(page, 'vice-cover-off-the-grid.png');
  await context.setOffline(false);

  // Incorrect file types must leave the previous image intact and show an error.
  await page.locator('#photo').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
  assert.match(await page.locator('#status').textContent(), /raster photo/);
  await page.locator('#caption').fill('W'.repeat(48));
  await page.locator('#tagline').fill('');
  await settle(page);
  await downloadPng(page, `vice-cover-${'w'.repeat(48)}.png`);

  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout must not overflow horizontally');
  const previewBox = await page.locator('.preview-section').boundingBox();
  const editorBox = await page.locator('.editor').boundingBox();
  assert.ok(previewBox.y < editorBox.y, 'Mobile preview should precede controls visually');

  const local = await context.newPage();
  monitor(local);
  await context.setOffline(true);
  await local.goto(pathToFileURL(path.join(root, 'app/index.html')).href, { waitUntil: 'load' });
  await local.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('Opening'));
  await settle(local);
  await downloadPng(local, 'vice-cover-vice-after-dark.png');
  await local.locator('#photo').setInputFiles(path.join(root, 'app/samples/boulevard.jpg'));
  await local.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Photo loaded'));
  await downloadPng(local, 'vice-cover-vice-after-dark.png');

  assert.deepEqual(issues, [], 'No uncaught browser exceptions');
  assert.deepEqual(external, [], 'No external network requests');
  for (const name of ['1-cover.jpg', '2-editor.jpg', '3-cover.jpg']) assert.ok((await stat(path.join(root, 'screenshots', name))).size < 262145);
  console.log('Browser checks passed: real photo upload, 3 layouts, 3 palettes, PNG signature/dimensions, offline editing, direct-file export, long titles, mobile fit, and zero external requests.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
