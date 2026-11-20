import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import '../src/cover.js';
import { createStudioServer } from '../../serve.ts';

const { WIDTH, HEIGHT, DEFAULTS, LAYOUTS, PALETTES, cropImage, normalizeSettings, filenameFor, fitTitle, panelBounds, illustratePixels, renderCover } = globalThis.ViceCover;

test('portrait export dimensions and default composition', () => {
  assert.equal(WIDTH, 1200);assert.equal(HEIGHT, 1500);
  assert.deepEqual(normalizeSettings(), { ...DEFAULTS });
  assert.deepEqual(Object.values(LAYOUTS).map(layout => layout.panels.length), [7, 5, 6]);
  assert.equal(Object.keys(PALETTES).length, 3);
});

test('settings clean empty titles, cap lengths, and reject inherited keys', () => {
  const settings = normalizeSettings({ caption: '\n\t ', tagline: 'ONE\nTWO', palette: '__proto__', layout: 'constructor', zoom: Infinity, focusX: -9, focusY: 22, intensity: NaN, grain: false });
  assert.equal(settings.caption, 'UNTITLED STORY');
  assert.equal(settings.tagline, 'ONE TWO');
  assert.equal(settings.layout, 'classic');assert.equal(settings.palette, 'sunset');
  assert.equal(settings.zoom, 1);assert.equal(settings.focusX, 0);assert.equal(settings.focusY, 1);
  assert.equal(settings.intensity, .65);assert.equal(settings.grain, false);
  assert.equal(normalizeSettings({ caption: 'a'.repeat(100), tagline: 'b'.repeat(100) }).caption.length, 48);
  assert.equal(normalizeSettings({ tagline: 'b'.repeat(100) }).tagline.length, 60);
  assert.equal(normalizeSettings({ tagline: '' }).tagline, '');
});

test('defaults and panel geometry cannot be mutated by callers', () => {
  assert.throws(() => { DEFAULTS.layout = 'grid'; }, TypeError);
  assert.throws(() => { LAYOUTS.classic.panels[0][0][0] = 2; }, TypeError);
  assert.throws(() => { PALETTES.sunset.sky = '#000'; }, TypeError);
});

test('crop fills a portrait target with a centered landscape image', () => {
  assert.deepEqual(cropImage(2000, 1000, 500, 1000), { sx: 750, sy: 0, sw: 500, sh: 1000 });
});

test('zoom and focus stay inside the original image at every edge', () => {
  for (const [w, h] of [[4000, 300], [300, 4000], [1000, 1000]]) {
    for (const zoom of [1, 1.5, 2, 100]) for (const x of [-1, 0, .5, 1, 8]) for (const y of [0, .5, 1]) {
      const crop = cropImage(w, h, 490, 650, zoom, x, y);
      assert.ok(crop.sx >= 0 && crop.sy >= 0);
      assert.ok(crop.sx + crop.sw <= w + .00001);
      assert.ok(crop.sy + crop.sh <= h + .00001);
      assert.ok(Math.abs(crop.sw / crop.sh - 490 / 650) < .00001);
    }
  }
});

test('invalid source dimensions fail explicitly', () => {
  for (const value of [0, -1, NaN, Infinity, '100']) assert.throws(() => cropImage(value, 100, 100, 100), RangeError);
});

test('every layout is bounded, nonempty, and covers the artboard', () => {
  function contains(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  for (const layout of Object.values(LAYOUTS)) {
    for (const polygon of layout.panels) {
      assert.ok(polygon.every(point => point.every(value => value >= 0 && value <= 1)));
      const bounds = panelBounds(polygon);
      assert.ok(bounds.width > 0 && bounds.height > 0);
    }
    for (let x = .017; x < 1; x += .033) for (let y = .019; y < 1; y += .037) {
      assert.ok(layout.panels.some(points => contains(x, y, points)), `Uncovered point ${x}, ${y} in ${layout.name}`);
    }
  }
});

test('title fitting handles long captions, long words, and blanks', () => {
  const measure = (text, size) => text.length * size * .61;
  for (const text of ['VICE AFTER DARK', 'W'.repeat(48), 'A very long name with many words along the coast', '']) {
    const title = fitTitle(text, measure, 970);
    assert.ok(title.lines.length >= 1 && title.lines.length <= 2);
    assert.ok(title.size > 0 && title.size <= 176);
    for (const line of title.lines) assert.ok(measure(line, title.size) <= 970);
  }
});

test('export filenames are safe, predictable, and support accents', () => {
  assert.equal(filenameFor('Vïce / After: Dark!?'), 'vice-cover-vice-after-dark.png');
  assert.equal(filenameFor(''), 'vice-cover-untitled.png');
  assert.equal(filenameFor('../../ 🌴'), 'vice-cover-untitled.png');
  assert.equal(filenameFor('My Story'), 'vice-cover-my-story.png');
});

test('illustration processing adds contour ink, preserves alpha, and leaves the source intact', () => {
  const source = new Uint8ClampedArray([15, 18, 21, 255, 240, 230, 220, 128, 245, 240, 235, 0]);
  const original = source.slice();
  const result = illustratePixels(source, 3, 1);
  assert.deepEqual(source, original);
  assert.deepEqual(result, illustratePixels(source, 3, 1));
  assert.deepEqual([result[3], result[7], result[11]], [255, 128, 0]);
  assert.ok(result[4] < source[4], 'Hard edges should receive dark contour ink');
  assert.throws(() => illustratePixels(source, 2, 2), RangeError);
});

function fakeCanvas() {
  const calls = [];
  let depth = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--;assert.ok(depth >= 0); },
    createLinearGradient() { return gradient; },
    measureText(text) { const match = /([\d.]+)px/.exec(this.font || '176px');return { width: text.length * Number(match[1]) * .6 }; }
  }, { get(target, property) { return property in target ? target[property] : (...args) => calls.push([property, ...args]); } });
  return { width: WIDTH, height: HEIGHT, getContext(type) { assert.equal(type, '2d');return ctx; }, calls, depth: () => depth };
}

test('all nine layout/palette combinations render and restore canvas state', () => {
  for (const layout of Object.keys(LAYOUTS)) for (const palette of Object.keys(PALETTES)) {
    const canvas = fakeCanvas();
    const result = renderCover(canvas, { naturalWidth: 544, naturalHeight: 720 }, { layout, palette, grain: false });
    assert.equal(result.panels, LAYOUTS[layout].panels.length);
    assert.equal(canvas.calls.filter(call => call[0] === 'drawImage').length, result.panels);
    assert.ok(canvas.calls.some(call => call[0] === 'fillText' && call[1].includes('DARK')));
    assert.equal(canvas.depth(), 0);
    assert.ok(canvas.calls.filter(call => call[0] === 'clip').length >= result.panels);
  }
});

test('procedural fallback renders without an image or external resource', () => {
  const canvas = fakeCanvas();
  renderCover(canvas, null, { caption: '', tagline: '', grain: true });
  assert.equal(canvas.calls.filter(call => call[0] === 'drawImage').length, 0);
  assert.ok(canvas.calls.filter(call => call[0] === 'fillRect').length > 11500);
  assert.equal(canvas.depth(), 0);
});

test('missing canvas support produces an actionable error', () => {
  assert.throws(() => renderCover({ getContext: () => null }, null), /2D canvas/);
});

test('browser entry uses local classic scripts for file:// compatibility', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const js = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /defer src="\.\/src\/cover\.js"/);
  assert.doesNotMatch(html, /type="module"/);
  assert.doesNotMatch(html + css, /(?:src|href)=["']https?:|@import|url\(["']?https?:/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  assert.match(js, /toBlob\(/);assert.match(js, /image\/png/);
});

function get(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);req.end();
  });
}

test('local server serves app assets and blocks traversal and writes', async () => {
  const server = createStudioServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const home = await get(port, '/');
    assert.equal(home.status, 200);assert.match(home.body.toString(), /Vice Cover Studio/);
    assert.match(home.headers['content-security-policy'], /connect-src 'none'/);
    const js = await get(port, '/src/cover.js');
    assert.equal(js.status, 200);assert.match(js.headers['content-type'], /javascript/);
    const head = await get(port, '/style.css', 'HEAD');
    assert.equal(head.status, 200);assert.equal(head.body.length, 0);
    assert.equal((await get(port, '/missing.png')).status, 404);
    assert.equal((await get(port, '/%2e%2e/LICENSE')).status, 403);
    assert.equal((await get(port, '/%00')).status, 400);
    assert.equal((await get(port, '/%zz')).status, 400);
    assert.equal((await get(port, '/', 'POST')).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
