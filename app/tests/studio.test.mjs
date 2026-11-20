import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { WIDTH, HEIGHT, layouts, bounds, crop, captionLines, exportName } from '../src/cover.js';
import { standalone } from '../../main.ts';

test('each arrangement tiles the cover with five nonempty panels and matching interior edges', () => {
  assert.ok(Object.keys(layouts).length >= 2);
  assert.equal(new Set(Object.values(layouts).map(value => JSON.stringify(value))).size, Object.keys(layouts).length);
  for (const [name, panels] of Object.entries(layouts)) {
    const edges = new Set();
    let area = 0;
    assert.equal(panels.length, 5);
    for (const points of panels) {
      let twice = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i+1) % points.length];
        assert.ok(a[0] >= 0 && a[0] <= WIDTH && a[1] >= 0 && a[1] <= HEIGHT);
        twice += a[0] * b[1] - b[0] * a[1];
        const border = [0, WIDTH].some(x => a[0] === x && b[0] === x) || [0, HEIGHT].some(y => a[1] === y && b[1] === y);
        if (!border && !edges.delete(`${b}:${a}`)) edges.add(`${a}:${b}`);
      }
      assert.ok(twice > 0);
      area += twice / 2;
    }
    assert.equal(edges.size, 0, name);
    assert.equal(area, WIDTH * HEIGHT, name);
  }
});

test('cropping covers the panels without stretching portrait or landscape images', () => {
  for (const panels of Object.values(layouts)) for (const panel of panels) {
    const {w,h} = bounds(panel);
    for (const [sw,sh] of [[19,10],[10,19],[12,12]]) for (const focus of [0,.5,1]) {
      const normal = crop(sw,sh,w,h,1,focus,1-focus);
      const [x,y,dw,dh] = crop(sw,sh,w,h,2,focus,1-focus);
      assert.ok(x >= 0 && y >= 0 && x + dw <= sw + 1e-8 && y + dh <= sh + 1e-8);
      assert.ok(Math.abs(dw / dh - w / h) < 1e-8);
      assert.equal(dw, normal[2] / 2);
      assert.equal(dh, normal[3] / 2);
    }
  }
});

test('captions retain words, flatten whitespace and handle blank or single-word titles', () => {
  assert.deepEqual(captionLines(' \t '), []);
  assert.deepEqual(captionLines('  Caf\u00e9  '), ['CAF\u00c9']);
  assert.deepEqual(captionLines('night  run\non the coast'), ['NIGHT RUN', 'ON THE COAST']);
  const text = '\u591c \u{1f334} M\u00c9XICO';
  assert.equal(captionLines(text).join(' '), text);
});

test('download names are portable and never contain path separators', () => {
  assert.equal(exportName('../ \u00c9t\u00e9 / Miami!?'), 'ete-miami.png');
  assert.equal(exportName('\u{1f334}'), 'vice-cover.png');
  assert.match(exportName('a'.repeat(80)), /^a{64}\.png$/);
});

test('standalone output embeds the editor script, stylesheet and network policy', async () => {
  const html = await standalone();
  assert.match(html, /<style>\s*:root/);
  assert.doesNotMatch(html, /<(?:script|link)\b[^>]+(?:src|href)="\./);
  assert.match(html, /connect-src 'none'/);
  const script = /<script type="module">([\s\S]+)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script));
});
