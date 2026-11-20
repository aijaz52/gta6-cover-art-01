import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { DEFAULTS, MAX_CAPTION, PALETTES, normalizeCaption, normalizeOptions, getPanels, coverCrop, captionLines, exportFilename, renderCover } from '../src/cover.js';
import { RasterCanvas } from '../../tools/authored-raster.mjs';

test('captions are plain, bounded Unicode text with stable whitespace', () => {
  assert.equal(normalizeCaption('  Vice\n  after\t hours  '), 'Vice after hours');
  assert.equal(normalizeCaption(null), '');
  assert.equal(normalizeCaption('e\u0301'), 'é');
  assert.equal(Array.from(normalizeCaption('🌴'.repeat(70))).length, MAX_CAPTION);
  assert.equal(normalizeCaption('<script>'), '<script>'); // Drawn to canvas, never injected as markup.
});

test('option normalization rejects invalid modes and clamps photo adjustments', () => {
  const value = normalizeOptions({ layout: '__proto__', palette: 'invalid', zoom: 90, panX: -3, panY: Infinity, grain: false });
  assert.equal(value.layout, DEFAULTS.layout); assert.equal(value.palette, DEFAULTS.palette);
  assert.equal(value.zoom, 2.5); assert.equal(value.panX, -1); assert.equal(value.panY, 0); assert.equal(value.grain, false);
  assert.equal(normalizeOptions({ zoom: 'oops' }).zoom, 1);
  assert.equal(normalizeOptions({ caption: '' }).caption, '');
});

test('both layouts have four independent panels and fill the whole cover', () => {
  for (const layout of ['classic', 'split']) {
    const p = getPanels(layout);
    assert.equal(p.length, 4); assert.equal(new Set(p.map(panel => panel.scene)).size, 4);
    let area = 0;
    for (const { points } of p) {
      assert.equal(points.length, 4);
      for (const [x, y] of points) { assert.ok(x >= 0 && x <= 1000); assert.ok(y >= 0 && y <= 1250); }
      area += Math.abs(points.reduce((sum, [x, y], i) => { const next = points[(i + 1) % points.length]; return sum + x * next[1] - next[0] * y; }, 0)) / 2;
    }
    assert.equal(area, 1_250_000);
    p[0].points[0][0] = 999;
    assert.equal(getPanels(layout)[0].points[0][0], 0);
  }
  assert.deepEqual(getPanels('missing'), getPanels('classic'));
  assert.deepEqual(getPanels('__proto__'), getPanels('classic'));
});

test('photo cropping always covers the destination at every pan extreme', () => {
  for (const [iw, ih] of [[1600, 900], [900, 1600], [40, 40]]) for (const zoom of [1, 1.5, 2.5]) for (const pan of [-1, 0, 1]) {
    const r = coverCrop(iw, ih, 20, 30, 400, 600, zoom, pan, -pan);
    assert.ok(r.x <= 20 + 1e-9 && r.y <= 30 + 1e-9);
    assert.ok(r.x + r.width >= 420 - 1e-9 && r.y + r.height >= 630 - 1e-9);
    assert.ok(Math.abs(r.width / r.height - iw / ih) < 1e-9);
  }
  assert.throws(() => coverCrop(0, 10, 0, 0, 100, 100), RangeError);
});

test('caption wrapping preserves words and limits the cover to three lines', () => {
  assert.deepEqual(captionLines('VICE AFTER HOURS'), ['VICE AFTER', 'HOURS']);
  assert.deepEqual(captionLines(''), []);
  const text = 'one two three four five six seven eight nine ten eleven';
  const lines = captionLines(text, 8);
  assert.ok(lines.length <= 3); assert.equal(lines.join(' '), normalizeCaption(text).toUpperCase());
  assert.deepEqual(captionLines('Supercalifragilisticexpialidocious'), ['SUPERCALIFRAGILISTICEXPIALIDOCIOUS']);
});

test('download filenames are safe and support empty or non-Latin captions', () => {
  assert.equal(exportFilename('Vice After Hours!'), 'vice-after-hours-cover.png');
  assert.equal(exportFilename('../../ Café 🌴'), 'cafe-cover.png');
  assert.equal(exportFilename('東京'), 'vice-cover.png');
});

test('renderer produces a deterministic, nonempty RGB PNG for all styles', () => {
  const hashes = new Set();
  for (const layout of ['classic', 'split']) for (const palette of Object.keys(PALETTES)) {
    const canvas = new RasterCanvas(200, 250);
    const result = renderCover(canvas, { layout, palette, caption: 'MIDNIGHT RUN' });
    assert.equal(result.layout, layout);
    const png = canvas.toPNG();
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 200); assert.equal(png.readUInt32BE(20), 250);
    const compressedLength = png.readUInt32BE(33);
    const raw = inflateSync(png.subarray(41, 41 + compressedLength));
    assert.equal(raw.length, (200 * 3 + 1) * 250);
    assert.ok(new Set(canvas.pixels).size > 100);
    hashes.add(png.toString('base64'));
  }
  assert.equal(hashes.size, 6);
  const a = new RasterCanvas(160, 200), b = new RasterCanvas(160, 200);
  renderCover(a); renderCover(b); assert.deepEqual(a.toPNG(), b.toPNG());
});

test('blank and long captions render without errors', () => {
  for (const caption of ['', 'x'.repeat(56), '🌴 NIGHTS & CITY LIGHTS']) {
    const canvas = new RasterCanvas(120, 150);
    assert.doesNotThrow(() => renderCover(canvas, { caption }));
    assert.ok(canvas.toPNG().length > 1000);
  }
});

test('the shipped page has accessible controls and local-only assets', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="cover"/); assert.match(html, /aria-live="polite"/);
  for (const id of ['photo-input', 'caption', 'resolution', 'export-button', 'reset-button', 'zoom', 'pan-x', 'pan-y']) assert.ok(html.includes(`id="${id}"`));
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  assert.doesNotMatch(js, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.match(js, /toBlob\(/); assert.match(js, /URL\.revokeObjectURL/);
});
