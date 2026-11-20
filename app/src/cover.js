/** Original rendering engine. Coordinates are in a 1000 × 1250 design space. */
export const WIDTH = 1000;
export const HEIGHT = 1250;
export const MAX_CAPTION = 56;
export const DEFAULTS = Object.freeze({ caption: 'VICE AFTER HOURS', layout: 'classic', palette: 'sunset', grain: true, zoom: 1, panX: 0, panY: 0 });
export const PALETTES = Object.freeze({
  sunset: { name: 'Vice sunset', sky: '#f6a789', glow: '#ffe5a0', water: '#52b4bc', dark: '#20233f', accent: '#f58cb5', skin: '#ce846b', light: '#fff3d9' },
  neon: { name: 'Neon nights', sky: '#9b77bd', glow: '#f5a9cf', water: '#3e91ae', dark: '#202239', accent: '#e982ba', skin: '#bd7b92', light: '#fcdfb7' },
  heat: { name: 'Golden hour', sky: '#e99b62', glow: '#ffe3a0', water: '#83a791', dark: '#353d37', accent: '#f6bc61', skin: '#b87c58', light: '#fff0cb' },
});

const panels = {
  classic: [
    { scene: 'city', points: [[0, 0], [620, 0], [555, 664], [0, 765]], crop: [0.17, 0.1, 1.04] },
    { scene: 'portrait', points: [[620, 0], [1000, 0], [1000, 600], [555, 664]], crop: [0.72, 0.15, 1.4] },
    { scene: 'boat', points: [[0, 765], [555, 664], [500, 1250], [0, 1250]], crop: [0.3, 0.7, 1.3] },
    { scene: 'car', points: [[555, 664], [1000, 600], [1000, 1250], [500, 1250]], crop: [0.72, 0.7, 1.2] },
  ],
  split: [
    { scene: 'city', points: [[0, 0], [1000, 0], [1000, 400], [0, 500]], crop: [0.5, 0.2, 1.05] },
    { scene: 'portrait', points: [[0, 500], [480, 452], [544, 1250], [0, 1250]], crop: [0.3, 0.5, 1.2] },
    { scene: 'car', points: [[480, 452], [1000, 400], [1000, 900], [520, 950.75]], crop: [0.7, 0.5, 1.3] },
    { scene: 'boat', points: [[520, 950.75], [1000, 900], [1000, 1250], [544, 1250]], crop: [0.65, 0.8, 1.1] },
  ],
};

export function normalizeCaption(value) {
  return Array.from(String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, MAX_CAPTION).join('');
}

export function normalizeOptions(input = {}) {
  const number = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
  return {
    caption: normalizeCaption(input.caption ?? DEFAULTS.caption),
    layout: Object.hasOwn(panels, input.layout) ? input.layout : DEFAULTS.layout,
    palette: Object.hasOwn(PALETTES, input.palette) ? input.palette : DEFAULTS.palette,
    grain: input.grain !== false,
    zoom: number(input.zoom ?? 1, 1, 1, 2.5),
    panX: number(input.panX ?? 0, 0, -1, 1),
    panY: number(input.panY ?? 0, 0, -1, 1),
  };
}

export function getPanels(layout = 'classic') {
  return (Object.hasOwn(panels, layout) ? panels[layout] : panels.classic).map(p => ({ ...p, points: p.points.map(pair => [...pair]), crop: [...p.crop] }));
}

export function coverCrop(iw, ih, x, y, w, h, zoom = 1, panX = 0, panY = 0) {
  if (![iw, ih, w, h, zoom].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Image and destination dimensions must be positive.');
  const scale = Math.max(w / iw, h / ih) * Math.max(1, zoom);
  const dw = iw * scale, dh = ih * scale;
  return { x: x - (dw - w) * (1 + Math.max(-1, Math.min(1, panX))) / 2, y: y - (dh - h) * (1 + Math.max(-1, Math.min(1, panY))) / 2, width: dw, height: dh };
}

export function captionLines(text, maxLength = 14) {
  const words = normalizeCaption(text).toLocaleUpperCase('en-US').split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + word.length + 1 > maxLength && lines.length < 2) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

export function exportFilename(caption) {
  const slug = normalizeCaption(caption).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return slug ? `${slug}-cover.png` : 'vice-cover.png';
}

function polygon(ctx, points, fill, stroke, width = 5) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, points, color, width = 4) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function gradient(ctx, y1, y2, a, b) { const g = ctx.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

function palm(ctx, x, y, scale, p) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  polygon(ctx, [[-14, 390], [1, 110], [-16, 0], [1, -5], [21, 110], [11, 390]], p.dark);
  const leaves = [ [[0, 0], [-85, -74], [-178, -46], [-104, -28], [-28, 12]], [[0, 0], [-95, 3], [-153, 80], [-77, 34]], [[0, 0], [-39, -113], [16, -156], [-4, -77], [15, 0]], [[0, 0], [63, -88], [161, -71], [81, -46]], [[0, 0], [98, -13], [160, 47], [73, 19]], [[0, 0], [63, 48], [78, 126], [32, 54]] ];
  for (const leaf of leaves) polygon(ctx, leaf, p.dark);
  ctx.restore();
}

function city(ctx, p) {
  rect(ctx, 0, 0, 1000, 1250, gradient(ctx, 0, 820, p.sky, p.glow));
  ellipse(ctx, 385, 292, 145, 145, p.glow);
  rect(ctx, 0, 590, 1000, 660, p.water);
  for (let i = 0; i < 15; i++) {
    const x = i * 78 - 20, h = 75 + ((i * 67) % 158);
    rect(ctx, x, 595 - h, 57, h, i % 2 ? '#94788a' : '#a68d98');
    for (let k = 0; k < 4; k++) rect(ctx, x + 9 + k * 11, 610 - h, 4, h - 25, p.glow);
  }
  polygon(ctx, [[-30, 687], [434, 557], [550, 583], [80, 790]], p.light, p.dark, 4);
  line(ctx, [[0, 728], [500, 583]], p.accent, 8);
  for (let i = 0; i < 16; i++) line(ctx, [[(i * 113) % 1000, 650 + i * 36], [(i * 113) % 1000 + 90, 650 + i * 36]], '#b5d4c2', 3);
  palm(ctx, 90, 190, 1.25, p); palm(ctx, 490, 365, 0.68, p);
  line(ctx, [[262, 204], [280, 197], [295, 204]], p.dark, 3);
  line(ctx, [[320, 173], [333, 168], [345, 173]], p.dark, 3);
}

function portrait(ctx, p) {
  rect(ctx, 0, 0, 1000, 1250, gradient(ctx, 0, 900, p.water, p.sky));
  for (let i = 0; i < 9; i++) polygon(ctx, [[i * 150 - 250, 1250], [i * 150 + 100, 0], [i * 150 + 170, 0], [i * 150 - 190, 1250]], '#ffffff17');
  palm(ctx, 930, 160, 0.75, p);
  polygon(ctx, [[530, 470], [545, 174], [622, 105], [784, 111], [871, 245], [862, 585]], p.dark, p.dark, 7);
  polygon(ctx, [[612, 437], [613, 571], [526, 631], [791, 722], [862, 600], [755, 552], [752, 424]], p.skin, p.dark, 7);
  polygon(ctx, [[584, 256], [630, 182], [771, 212], [807, 346], [770, 461], [701, 510], [619, 459], [578, 345]], p.skin, p.dark, 7);
  polygon(ctx, [[604, 249], [662, 218], [776, 266], [765, 178], [628, 153], [571, 250], [556, 428], [597, 391]], p.dark);
  polygon(ctx, [[570, 639], [623, 574], [703, 643], [785, 581], [894, 678], [960, 1150], [437, 1150]], p.light, p.dark, 8);
  polygon(ctx, [[619, 580], [697, 648], [671, 793], [583, 662]], p.accent, p.dark, 5);
  polygon(ctx, [[784, 583], [697, 648], [733, 793], [829, 653]], p.accent, p.dark, 5);
  polygon(ctx, [[594, 290], [686, 296], [677, 354], [613, 346]], p.dark, p.dark, 6);
  polygon(ctx, [[710, 299], [795, 291], [784, 347], [723, 354]], p.dark, p.dark, 6);
  line(ctx, [[681, 310], [714, 310]], p.dark, 10);
  line(ctx, [[607, 302], [654, 312]], p.water, 5); line(ctx, [[725, 310], [769, 301]], p.water, 5);
  line(ctx, [[696, 335], [686, 384], [706, 391]], '#8e535d', 5);
  line(ctx, [[668, 425], [709, 431], [733, 421]], p.dark, 5);
  ellipse(ctx, 597, 390, 13, 23, p.glow, p.dark, 4);
  line(ctx, [[712, 663], [718, 1080]], p.dark, 5);
  for (let i = 0; i < 4; i++) ellipse(ctx, 739, 816 + i * 73, 5, 5, p.dark);
  polygon(ctx, [[840, 718], [878, 930], [820, 1120], [776, 1088], [803, 917], [780, 774]], p.skin, p.dark, 7);
}

function boat(ctx, p) {
  rect(ctx, 0, 0, 1000, 1250, gradient(ctx, 600, 1250, p.water, '#266b86'));
  for (let i = 0; i < 28; i++) line(ctx, [[(i * 71) % 1000 - 100, 700 + i * 23], [(i * 71) % 1000 + 140, 656 + i * 23]], i % 3 ? '#8bcbce' : p.light, i % 3 ? 3 : 8);
  polygon(ctx, [[-70, 1035], [392, 805], [541, 848], [271, 1105], [59, 1142]], p.light, p.dark, 9);
  polygon(ctx, [[-40, 1039], [258, 1063], [516, 858], [282, 1114], [57, 1134]], p.accent, p.dark, 5);
  polygon(ctx, [[126, 1004], [247, 864], [359, 850], [336, 931], [271, 996]], p.dark, p.dark, 6);
  polygon(ctx, [[180, 971], [259, 880], [335, 868], [304, 930]], p.water);
  line(ctx, [[-40, 1137], [126, 1168], [314, 1091]], p.light, 17);
  line(ctx, [[-40, 1170], [140, 1192], [317, 1120]], '#c8e4dc', 7);
}

function car(ctx, p) {
  rect(ctx, 0, 0, 1000, 1250, gradient(ctx, 500, 1250, p.sky, p.glow));
  rect(ctx, 0, 930, 1000, 320, '#626076');
  polygon(ctx, [[0, 1190], [1000, 1020], [1000, 1050], [0, 1230]], p.light);
  for (let i = 0; i < 6; i++) palm(ctx, 520 + i * 120, 735 - i * 19, 0.32, p);
  ellipse(ctx, 800, 1136, 254, 47, '#25243b88');
  ellipse(ctx, 635, 1081, 48, 76, p.dark, p.dark, 6);
  ellipse(ctx, 923, 1031, 42, 68, p.dark, p.dark, 6);
  polygon(ctx, [[516, 1013], [566, 912], [708, 822], [873, 810], [979, 902], [1009, 1021], [579, 1124], [520, 1088]], p.accent, p.dark, 9);
  polygon(ctx, [[590, 915], [722, 838], [858, 830], [911, 904], [723, 956]], p.dark, p.dark, 6);
  polygon(ctx, [[623, 910], [731, 853], [771, 849], [770, 927], [724, 939]], p.water);
  polygon(ctx, [[790, 847], [851, 845], [886, 900], [789, 927]], '#8dd0ce');
  polygon(ctx, [[533, 1016], [725, 976], [977, 925], [1003, 976], [580, 1094], [526, 1060]], '#e7b1bc', p.dark, 5);
  polygon(ctx, [[543, 1026], [607, 1014], [605, 1044], [538, 1057]], p.glow, p.dark, 4);
  polygon(ctx, [[647, 1006], [713, 991], [713, 1022], [647, 1040]], p.glow, p.dark, 4);
  line(ctx, [[559, 1080], [717, 1040]], p.dark, 9);
  line(ctx, [[782, 956], [799, 1022], [899, 994]], p.dark, 4);
  line(ctx, [[815, 956], [842, 950]], p.dark, 5);
}

const sceneRenderers = { city, portrait, boat, car };

export function renderCover(canvas, input = {}, image = null) {
  const opts = normalizeOptions(input);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser does not support a 2D canvas.');
  const palette = PALETTES[opts.palette];
  ctx.save(); ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
  rect(ctx, 0, 0, WIDTH, HEIGHT, palette.dark);
  for (const panel of getPanels(opts.layout)) {
    ctx.save(); polygon(ctx, panel.points); ctx.clip();
    if (image) {
      const xs = panel.points.map(p => p[0]), ys = panel.points.map(p => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      const r = coverCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, x, y, w, h, opts.zoom * panel.crop[2], opts.panX + (panel.crop[0] - 0.5) * 0.45, opts.panY + (panel.crop[1] - 0.5) * 0.45);
      ctx.filter = 'saturate(1.35) contrast(1.18)'; ctx.drawImage(image, r.x, r.y, r.width, r.height); ctx.filter = 'none';
      ctx.globalCompositeOperation = 'soft-light'; rect(ctx, x, y, w, h, gradient(ctx, y, y + h, palette.sky, palette.water));
      ctx.globalCompositeOperation = 'source-over'; rect(ctx, x, y, w, h, gradient(ctx, y, y + h, '#20233f00', '#20233f55'));
    } else {
      if (opts.layout === 'split') {
        if (panel.scene === 'portrait') { ctx.translate(-500, 350); ctx.scale(1.1, 0.8); }
        if (panel.scene === 'car') ctx.translate(0, -270);
        if (panel.scene === 'boat') ctx.translate(500, 85);
      }
      sceneRenderers[panel.scene](ctx, palette);
    }
    ctx.restore(); polygon(ctx, panel.points, null, '#181a2a', 14);
  }
  if (opts.grain) {
    let seed = 73;
    ctx.fillStyle = '#fff5dc'; ctx.globalAlpha = 0.1;
    for (let i = 0; i < 4600; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed % WIDTH; seed = (seed * 1664525 + 1013904223) >>> 0; ctx.fillRect(x, seed % HEIGHT, 1.3, 1.3); }
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left'; ctx.fillStyle = palette.light; ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('AN INDEPENDENT COVER STORY', 31, 42);
  ctx.textAlign = 'right'; ctx.fillText('VOL. 01', 970, 42);
  const lines = captionLines(opts.caption);
  if (lines.length) {
    const maxWidth = 876, baseSize = lines.length === 1 ? 143 : 155;
    ctx.font = `900 ${baseSize}px Impact, 'Arial Black', sans-serif`;
    const longest = Math.max(...lines.map(l => ctx.measureText(l).width));
    const fontSize = Math.min(baseSize, baseSize * maxWidth / Math.max(1, longest));
    const lineHeight = fontSize * 0.98;
    const start = 875 - ((lines.length - 1) * lineHeight) / 2;
    ctx.font = `900 ${fontSize}px Impact, 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    lines.forEach((text, index) => {
      const y = start + index * lineHeight;
      ctx.strokeStyle = '#181a2a'; ctx.lineWidth = 22; ctx.strokeText(text, 506, y + 8);
      ctx.fillStyle = palette.accent; ctx.fillText(text, 506, y + 8);
      ctx.strokeStyle = '#181a2a'; ctx.lineWidth = 13; ctx.strokeText(text, 500, y);
      ctx.fillStyle = '#fff8e8'; ctx.fillText(text, 500, y);
    });
  }
  ctx.font = 'bold 13px Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = palette.light; ctx.fillText('GOOD STORIES. QUESTIONABLE DECISIONS.', 30, 1219);
  ctx.textAlign = 'right'; ctx.fillText('CUSTOM EDITION', 970, 1219);
  ctx.strokeStyle = '#181a2a'; ctx.lineWidth = 16; ctx.strokeRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
  return opts;
}
