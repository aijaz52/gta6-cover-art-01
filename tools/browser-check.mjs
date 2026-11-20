import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const entry = pathToFileURL(resolve(process.argv[2] ?? 'dist/index.html')).href;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({offline:true, viewport:{width:1440,height:900}});
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(entry);
  const preview = page.locator('#preview');
  const raster = () => preview.evaluate(canvas => canvas.toDataURL());
  await page.waitForFunction(() => document.querySelector('canvas').getContext('2d').getImageData(80,80,1,1).data[0] > 10);
  const demo = await raster();
  if (process.env.STUDIO_SCREENSHOT) await page.screenshot({path:process.env.STUDIO_SCREENSHOT, fullPage:true});
  const photo = await page.evaluate(() => {
    const canvas = Object.assign(document.createElement('canvas'), {width:360,height:210});
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#53cce0'; ctx.fillRect(0,0,360,210);
    ctx.fillStyle = '#ffa898'; ctx.fillRect(21,38,160,119);
    ctx.fillStyle = '#322845'; ctx.fillRect(238,68,72,132);
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#photo').setInputFiles({name:'test-photo.png', mimeType:'image/png', buffer:Buffer.from(photo,'base64')});
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Photo ready.');
  const redraw = async previous => {
    await page.waitForFunction(data => document.querySelector('canvas').toDataURL() !== data, previous);
    return raster();
  };
  const uploaded = await redraw(demo);
  await page.getByLabel('Caption').fill('Night Shift');
  const titled = await redraw(uploaded);
  await page.getByText('Crossfire', {exact:true}).click();
  const rearranged = await redraw(titled);
  await page.getByText('Lagoon', {exact:true}).click();
  await redraw(rearranged);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', {name:'Download PNG'}).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'night-shift.png');
  const png = await readFile(await download.path());
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1920);
  assert.equal(png.readUInt32BE(20), 2400);
  const graphic = await page.evaluate(async encoded => {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], {type:'image/png'}));
    const canvas = Object.assign(document.createElement('canvas'), {width:16, height:20});
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0,16,20);
    const pixels = ctx.getImageData(0,0,16,20).data;
    return {opaque:pixels.every((value,i) => i % 4 !== 3 || value === 255), colors:new Set(pixels).size};
  }, png.toString('base64'));
  assert.ok(graphic.opaque && graphic.colors > 30);
  await page.setViewportSize({width:360,height:760});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  if (process.env.STUDIO_MOBILE_SCREENSHOT) await page.screenshot({path:process.env.STUDIO_MOBILE_SCREENSHOT, fullPage:true});
  await page.getByRole('button', {name:'Reset editor'}).click();
  await page.waitForFunction(data => document.querySelector('canvas').toDataURL() === data, demo);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log('Offline Chromium check passed: photo, caption, layout, palette, PNG, mobile and reset.');
} finally {
  await browser.close();
}
