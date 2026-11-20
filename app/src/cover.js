/* Original canvas compositor. Shared unchanged between the browser and Node tests. */
(function (scope) {
  'use strict';

  const WIDTH = 1200;
  const HEIGHT = 1500;
  const PALETTES = Object.freeze({
    sunset: Object.freeze({ name: 'Vice sunset', sky: '#f59cc2', light: '#ffd8a0', dark: '#492454', accent: '#75c4c1', paper: '#fff0d6' }),
    neon: Object.freeze({ name: 'Neon nights', sky: '#ad80e8', light: '#80e9df', dark: '#20254f', accent: '#ed79b3', paper: '#e9f9eb' }),
    gold: Object.freeze({ name: 'Golden hour', sky: '#f5bd72', light: '#ffe5ac', dark: '#583d4a', accent: '#96b5a1', paper: '#fff3da' })
  });
  const LAYOUTS = Object.freeze({
    classic: Object.freeze({ name: 'The classic', panels: [
      [[0, 0], [.34, 0], [.30, .30], [0, .30]],
      [[.34, 0], [.71, 0], [.69, .30], [.30, .30]],
      [[.71, 0], [1, 0], [1, .30], [.69, .30]],
      [[0, .30], [.60, .30], [.64, .75], [0, .75]],
      [[.60, .30], [1, .30], [1, .75], [.64, .75]],
      [[0, .75], [.51, .75], [.48, 1], [0, 1]],
      [[.51, .75], [1, .75], [1, 1], [.48, 1]]
    ] }),
    diagonal: Object.freeze({ name: 'Split second', panels: [
      [[0, 0], [.63, 0], [.53, .33], [0, .41]],
      [[.63, 0], [1, 0], [1, .34], [.53, .33]],
      [[0, .39], [1, .24], [1, .68], [0, .80]],
      [[0, .80], [.46, .74], [.58, 1], [0, 1]],
      [[.46, .74], [1, .68], [1, 1], [.58, 1]]
    ] }),
    grid: Object.freeze({ name: 'Six stories', panels: [
      [[0, 0], [.53, 0], [.53, .30], [0, .30]],
      [[.53, 0], [1, 0], [1, .30], [.53, .30]],
      [[0, .30], [.40, .30], [.40, .73], [0, .73]],
      [[.40, .30], [1, .30], [1, .73], [.40, .73]],
      [[0, .73], [.62, .73], [.62, 1], [0, 1]],
      [[.62, .73], [1, .73], [1, 1], [.62, 1]]
    ] })
  });
  for (const layout of Object.values(LAYOUTS)) {
    for (const panel of layout.panels) {
      panel.forEach(Object.freeze);
      Object.freeze(panel);
    }
    Object.freeze(layout.panels);
  }

  const DEFAULTS = Object.freeze({ caption: 'VICE AFTER DARK', tagline: 'A LITTLE SUN. A LOT OF TROUBLE.', layout: 'classic', palette: 'sunset', zoom: 1, focusX: .5, focusY: .5, intensity: .65, grain: true });
  function clamp(value, lower, upper, fallback = lower) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(lower, Math.min(upper, number)) : fallback;
  }
  function cleanText(text, max) {
    return String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function normalizeSettings(settings = {}) {
    return {
      caption: cleanText(settings.caption ?? DEFAULTS.caption, 48) || 'UNTITLED STORY',
      tagline: cleanText(settings.tagline ?? DEFAULTS.tagline, 60),
      layout: Object.hasOwn(LAYOUTS, settings.layout) ? settings.layout : DEFAULTS.layout,
      palette: Object.hasOwn(PALETTES, settings.palette) ? settings.palette : DEFAULTS.palette,
      zoom: clamp(settings.zoom ?? 1, 1, 2, 1),
      focusX: clamp(settings.focusX ?? .5, 0, 1, .5),
      focusY: clamp(settings.focusY ?? .5, 0, 1, .5),
      intensity: clamp(settings.intensity ?? .65, 0, 1, .65),
      grain: settings.grain !== false
    };
  }
  function cropImage(sourceWidth, sourceHeight, targetWidth, targetHeight, zoom = 1, focusX = .5, focusY = .5) {
    if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Image dimensions must be positive finite numbers.');
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * clamp(zoom, 1, 2, 1);
    const sw = targetWidth / scale;
    const sh = targetHeight / scale;
    return { sx: (sourceWidth - sw) * clamp(focusX, 0, 1, .5), sy: (sourceHeight - sh) * clamp(focusY, 0, 1, .5), sw, sh };
  }
  function panelBounds(points) {
    const xs = points.map(point => point[0] * WIDTH);
    const ys = points.map(point => point[1] * HEIGHT);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  function filenameFor(caption) {
    const slug = cleanText(caption, 48).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `vice-cover-${slug || 'untitled'}.png`;
  }
  function fitTitle(caption, measure, maxWidth, maxSize = 176) {
    const words = cleanText(caption, 48).toUpperCase().split(' ').filter(Boolean);
    if (!words.length) words.push('UNTITLED', 'STORY');
    let best = null;
    for (let split = 0; split < words.length; split++) {
      const lines = split === 0 ? [words.join(' ')] : [words.slice(0, split).join(' '), words.slice(split).join(' ')];
      let size = maxSize;
      const widest = Math.max(...lines.map(line => measure(line, size)));
      if (widest > maxWidth) size *= maxWidth / widest;
      size = Math.max(8, Math.floor(size));
      const score = size - (lines.length === 1 && words.length > 1 ? 16 : 0);
      if (!best || score > best.score) best = { lines, size, score };
    }
    return { lines: best.lines, size: best.size };
  }
  function pathPanel(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x * WIDTH, y * HEIGHT) : ctx.moveTo(x * WIDTH, y * HEIGHT));
    ctx.closePath();
  }
  function seeded(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  function illustratePixels(rgba, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) throw new RangeError('Expected a complete RGBA image.');
    const result = new Uint8ClampedArray(rgba.length);
    const light = new Float32Array(width * height);
    for (let i = 0, pixel = 0; i < rgba.length; i += 4, pixel++) light[pixel] = rgba[i] * .299 + rgba[i + 1] * .587 + rgba[i + 2] * .114;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pixel = y * width + x, offset = pixel * 4;
      const horizontal = Math.abs(light[y * width + Math.min(width - 1, x + 1)] - light[y * width + Math.max(0, x - 1)]);
      const vertical = Math.abs(light[Math.min(height - 1, y + 1) * width + x] - light[Math.max(0, y - 1) * width + x]);
      const edge = horizontal + vertical;
      const ink = edge > 115 ? .48 : edge > 70 ? .74 : 1;
      for (let channel = 0; channel < 3; channel++) {
        const value = (rgba[offset + channel] - 128) * 1.04 + 128;
        result[offset + channel] = Math.round(value / 24) * 24 * ink;
      }
      result[offset + 3] = rgba[offset + 3];
    }
    return result;
  }
  function palm(ctx, x, y, height, color, lean = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(lean, 1);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = height * .045;
    ctx.lineCap = 'round';
    ctx.beginPath();ctx.moveTo(0, 0);ctx.quadraticCurveTo(-height * .11, -height * .48, height * .08, -height);ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const angle = -.25 + i * Math.PI / 3.6;
      const tx = height * .08, ty = -height;
      const ex = tx + Math.cos(angle) * height * .38, ey = ty + Math.sin(angle) * height * .22;
      ctx.beginPath();ctx.moveTo(tx, ty);ctx.quadraticCurveTo(tx + (ex - tx) * .5, ty - height * .17, ex, ey);ctx.quadraticCurveTo(tx + (ex - tx) * .6, ty - height * .04, tx, ty);ctx.fill();
    }
    ctx.restore();
  }
  function drawScenery(ctx, bounds, index, palette) {
    const { x, y, width, height } = bounds;
    const random = seeded(1701 + index * 153);
    const gradient = ctx.createLinearGradient(0, y, 0, y + height);
    gradient.addColorStop(0, palette.sky);gradient.addColorStop(.62, palette.light);gradient.addColorStop(1, palette.dark);
    ctx.fillStyle = gradient;ctx.fillRect(x, y, width, height);
    ctx.fillStyle = palette.light;ctx.beginPath();ctx.arc(x + width * .73, y + height * .35, Math.min(width, height) * .18, 0, Math.PI * 2);ctx.fill();
    const horizon = y + height * .73;
    ctx.fillStyle = palette.accent;ctx.fillRect(x, horizon, width, height * .27);
    ctx.globalAlpha = .35;ctx.fillStyle = palette.light;
    for (let i = 0; i < 16; i++) ctx.fillRect(x + random() * width, horizon + random() * height * .25, random() * width * .25, 2 + random() * 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.dark;
    for (let i = 0; i < 12; i++) {
      const bw = width / 11, bh = height * (.05 + random() * .2);
      ctx.fillRect(x + i * bw, horizon - bh, bw * .85, bh);
      ctx.fillStyle = palette.light;ctx.globalAlpha = .6;
      for (let j = 0; j < 3; j++) ctx.fillRect(x + i * bw + bw * .2, horizon - bh + 9 + j * 12, bw * .14, 4);
      ctx.globalAlpha = 1;ctx.fillStyle = palette.dark;
    }
    palm(ctx, x + width * .17, y + height * 1.09, height * .88, palette.dark);
    if (index % 2 === 0) palm(ctx, x + width * .91, y + height * 1.05, height * .62, palette.dark, -1);
  }
  function drawPanel(ctx, points, index, photo, settings, palette) {
    const bounds = panelBounds(points);
    ctx.save();pathPanel(ctx, points);ctx.clip();
    drawScenery(ctx, bounds, index, palette);
    if (photo && (photo.naturalWidth || photo.width) > 0) {
      const offsets = [[-.48, -.48], [.16, -.26], [.48, .32], [0, -.1], [.36, .16], [-.46, .48], [.28, .32]];
      const magnifications = [1.85, 1.45, 1.9, 1, 1.5, 1.85, 1.35];
      const [dx, dy] = offsets[index % offsets.length];
      const crop = cropImage(photo.naturalWidth || photo.width, photo.naturalHeight || photo.height, bounds.width, bounds.height, settings.zoom * magnifications[index % magnifications.length], settings.focusX + dx, settings.focusY + dy);
      ctx.filter = `contrast(${1 + settings.intensity * .6}) saturate(${1 + settings.intensity * .45}) brightness(1.04)`;
      ctx.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'soft-light';ctx.globalAlpha = settings.intensity * .8;
      ctx.fillStyle = index % 3 === 0 ? palette.sky : index % 3 === 1 ? palette.light : palette.accent;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.globalCompositeOperation = 'source-over';ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, bounds.y, 0, bounds.y + bounds.height);
      shade.addColorStop(0, '#17101f00');shade.addColorStop(.68, '#17101f08');shade.addColorStop(1, '#17101f80');
      ctx.fillStyle = shade;ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      // Inky silhouettes unify the photographic crops into a cover composition.
      if (index === 0 || index === 5) palm(ctx, bounds.x + bounds.width * .16, bounds.y + bounds.height * 1.16, bounds.height * .83, '#211526', index === 0 ? 1 : -1);
    }
    ctx.restore();
    ctx.save();pathPanel(ctx, points);ctx.lineWidth = 14;ctx.lineJoin = 'round';ctx.strokeStyle = '#17121c';ctx.stroke();ctx.restore();
  }
  function titleFont(size) { return `900 ${size}px Impact, "Arial Black", sans-serif`; }
  function renderCover(canvas, photo, input = {}) {
    const settings = normalizeSettings(input);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D canvas is required to create your cover.');
    const palette = PALETTES[settings.palette];
    const layout = LAYOUTS[settings.layout];
    ctx.save();
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#17121c';ctx.fillRect(0, 0, WIDTH, HEIGHT);
    layout.panels.forEach((points, index) => drawPanel(ctx, points, index, photo, settings, palette));
    // Small editorial devices are part of the artwork, never an app watermark.
    ctx.save();ctx.translate(56, 63);ctx.rotate(-.035);
    ctx.fillStyle = '#17121c';ctx.fillRect(-13, -25, 309, 47);
    ctx.font = '700 21px Arial, sans-serif';ctx.fillStyle = palette.paper;ctx.fillText('SUNSHINE & CONSEQUENCES', 0, 7, 281);ctx.restore();
    const title = fitTitle(settings.caption, (text, size) => { ctx.font = titleFont(size); return ctx.measureText(text).width; }, 970);
    const lineHeight = title.size * .92;
    const blockHeight = title.lines.length * lineHeight;
    const centerY = 1030;
    ctx.save();ctx.translate(WIDTH / 2, centerY);ctx.rotate(-.045);
    const backingWidth = Math.min(1090, Math.max(650, ...title.lines.map(line => { ctx.font = titleFont(title.size); return ctx.measureText(line).width + 100; })));
    ctx.fillStyle = '#17121cec';
    ctx.beginPath();ctx.moveTo(-backingWidth / 2 - 10, -blockHeight / 2 - 31);ctx.lineTo(backingWidth / 2 + 20, -blockHeight / 2 - 46);ctx.lineTo(backingWidth / 2, blockHeight / 2 + 37);ctx.lineTo(-backingWidth / 2 - 20, blockHeight / 2 + 48);ctx.closePath();ctx.fill();
    ctx.font = titleFont(title.size);ctx.textAlign = 'center';ctx.textBaseline = 'middle';ctx.lineJoin = 'round';
    title.lines.forEach((line, index) => {
      const y = (index - (title.lines.length - 1) / 2) * lineHeight;
      ctx.strokeStyle = '#17121c';ctx.lineWidth = 17;ctx.strokeText(line, 0, y + 7);
      ctx.fillStyle = palette.sky;ctx.fillText(line, 5, y + 9);
      ctx.strokeStyle = '#17121c';ctx.lineWidth = 4;ctx.strokeText(line, 0, y);
      ctx.fillStyle = palette.paper;ctx.fillText(line, 0, y);
    });
    ctx.restore();
    if (settings.tagline) {
      ctx.save();ctx.textAlign = 'center';ctx.font = '700 23px Arial, sans-serif';
      const text = settings.tagline.toUpperCase();
      const size = Math.min(23, 1050 / Math.max(1, ctx.measureText(text).width) * 23);
      ctx.font = `700 ${size}px Arial, sans-serif`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = '#17121c';ctx.fillRect((WIDTH - tw) / 2 - 22, HEIGHT - 91, tw + 44, 47);
      ctx.fillStyle = palette.paper;ctx.fillText(text, WIDTH / 2, HEIGHT - 59);ctx.restore();
    }
    if (settings.grain) {
      const random = seeded(641976);
      ctx.save();
      for (let i = 0; i < 11500; i++) {
        ctx.fillStyle = i % 2 ? '#fff8e617' : '#160c251c';
        const size = 1 + random() * 2.3;
        ctx.fillRect(random() * WIDTH, random() * HEIGHT, size, size);
      }
      ctx.restore();
    }
    ctx.strokeStyle = '#17121c';ctx.lineWidth = 24;ctx.strokeRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
    return { width: canvas.width, height: canvas.height, panels: layout.panels.length, settings };
  }
  scope.ViceCover = Object.freeze({ WIDTH, HEIGHT, DEFAULTS, LAYOUTS, PALETTES, normalizeSettings, cropImage, panelBounds, filenameFor, fitTitle, illustratePixels, renderCover });
})(globalThis);
