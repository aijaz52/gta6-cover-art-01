/** Small, self-authored software canvas for a portable Node-only sample export.
 * Browser exports use the browser's full canvas engine and installed fonts.
 */
import { deflateSync } from 'node:zlib';

const GLYPHS = {
  A: ['01110','11011','11011','11111','11011','11011','11011'], B: ['11110','11011','11011','11110','11011','11011','11110'],
  C: ['01111','11000','11000','11000','11000','11000','01111'], D: ['11110','11011','11011','11011','11011','11011','11110'],
  E: ['11111','11000','11000','11110','11000','11000','11111'], F: ['11111','11000','11000','11110','11000','11000','11000'],
  G: ['01111','11000','11000','11011','11011','11011','01111'], H: ['11011','11011','11011','11111','11011','11011','11011'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00011','00011','00011','11011','11011','01110'],
  K: ['11011','11011','11110','11100','11110','11011','11011'], L: ['11000','11000','11000','11000','11000','11000','11111'],
  M: ['10001','11011','11111','10101','10101','10101','10101'], N: ['11001','11101','11101','11011','11011','11011','11001'],
  O: ['01110','11011','11011','11011','11011','11011','01110'], P: ['11110','11011','11011','11110','11000','11000','11000'],
  Q: ['01110','11011','11011','11011','11111','01110','00011'], R: ['11110','11011','11011','11110','11100','11010','11011'],
  S: ['01111','11000','11000','01110','00011','00011','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['11011','11011','11011','11011','11011','11011','01110'], V: ['11011','11011','11011','11011','11011','01010','00100'],
  W: ['10101','10101','10101','10101','11111','11011','10001'], X: ['11011','11011','01010','00100','01010','11011','11011'],
  Y: ['11011','11011','11011','01110','00100','00100','00100'], Z: ['11111','00011','00110','00100','01100','11000','11111'],
  '0': ['01110','11011','11011','11011','11011','11011','01110'], '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'], '?': ['01110','11011','00011','00110','00100','00000','00100'],
};

function rgba(color) {
  const h = color.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
}

export class RasterCanvas {
  constructor(width = 1000, height = 1250) {
    this.width = width; this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
    this.context = new RasterContext(this);
  }
  getContext(kind) { if (kind !== '2d') return null; return this.context; }
  toPNG() {
    const raw = Buffer.alloc((this.width * 3 + 1) * this.height);
    for (let y = 0; y < this.height; y++) raw.set(this.pixels.subarray(y * this.width * 3, (y + 1) * this.width * 3), y * (this.width * 3 + 1) + 1);
    const header = Buffer.alloc(13); header.writeUInt32BE(this.width, 0); header.writeUInt32BE(this.height, 4); header[8] = 8; header[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
}

function chunk(name, data) {
  const type = Buffer.from(name), result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); type.copy(result, 4); data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return result;
}

class RasterContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = { sx: 1, sy: 1, tx: 0, ty: 0, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1, font: '12px Arial', textAlign: 'left', clips: [] };
    this.stack = []; this.path = []; this.closed = false;
  }
  save() { this.stack.push({ ...this.state, clips: [...this.state.clips] }); }
  restore() { if (this.stack.length) this.state = this.stack.pop(); }
  scale(x, y) { this.state.sx *= x; this.state.sy *= y; }
  translate(x, y) { this.state.tx += x * this.state.sx; this.state.ty += y * this.state.sy; }
  point(x, y) { return [x * this.state.sx + this.state.tx, y * this.state.sy + this.state.ty]; }
  beginPath() { this.path = []; this.closed = false; }
  moveTo(x, y) { this.path.push(this.point(x, y)); }
  lineTo(x, y) { this.path.push(this.point(x, y)); }
  closePath() { this.closed = true; }
  ellipse(x, y, rx, ry) { for (let i = 0; i < 64; i++) { const t = i * Math.PI / 32; this.path.push(this.point(x + Math.cos(t) * rx, y + Math.sin(t) * ry)); } this.closed = true; }
  clip() {
    const rows = [];
    for (let y = 0; y < this.canvas.height; y++) { const hits = intersections(this.path, y + 0.5); rows.push(hits.length > 1 ? [Math.ceil(hits[0]), Math.floor(hits.at(-1))] : [1, 0]); }
    this.state.clips.push(rows);
  }
  createLinearGradient(x1, y1, x2, y2) {
    const start = this.point(x1, y1), end = this.point(x2, y2);
    return { start, end, stops: [], addColorStop(offset, color) { this.stops.push([offset, rgba(color)]); this.stops.sort((a, b) => a[0] - b[0]); } };
  }
  colorAt(style, y) {
    if (typeof style === 'string') return rgba(style);
    const t = Math.max(0, Math.min(1, (y - style.start[1]) / (style.end[1] - style.start[1] || 1)));
    const a = style.stops[0][1], b = style.stops.at(-1)[1];
    return a.map((v, i) => v + (b[i] - v) * t);
  }
  span(y, from, to, style) {
    if (y < 0 || y >= this.canvas.height) return;
    let left = Math.max(0, Math.ceil(from)), right = Math.min(this.canvas.width - 1, Math.floor(to));
    for (const clip of this.state.clips) { left = Math.max(left, clip[y][0]); right = Math.min(right, clip[y][1]); }
    if (left > right) return;
    const c = this.colorAt(style, y), a = c[3] * this.state.globalAlpha, pixels = this.canvas.pixels;
    for (let x = left; x <= right; x++) { const i = (y * this.canvas.width + x) * 3; for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(c[k] * a + pixels[i + k] * (1 - a)); }
  }
  fill() {
    if (this.path.length < 3) return;
    const minY = Math.max(0, Math.ceil(Math.min(...this.path.map(p => p[1])))), maxY = Math.min(this.canvas.height - 1, Math.floor(Math.max(...this.path.map(p => p[1]))));
    for (let y = minY; y <= maxY; y++) { const hits = intersections(this.path, y + 0.5); for (let i = 0; i + 1 < hits.length; i += 2) this.span(y, hits[i], hits[i + 1], this.state.fillStyle); }
  }
  stroke() {
    const count = this.closed ? this.path.length : this.path.length - 1;
    for (let i = 0; i < count; i++) {
      const a = this.path[i], b = this.path[(i + 1) % this.path.length];
      const radius = this.state.lineWidth * Math.abs(this.state.sx) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length * radius, ny = dx / length * radius;
      const oldPath = this.path, oldFill = this.state.fillStyle;
      this.path = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
      this.state.fillStyle = this.state.strokeStyle; this.fill(); this.path = oldPath; this.state.fillStyle = oldFill;
    }
  }
  fillRect(x, y, w, h) {
    const a = this.point(x, y), b = this.point(x + w, y + h);
    for (let row = Math.max(0, Math.floor(a[1])); row < Math.min(this.canvas.height, Math.ceil(b[1])); row++) this.span(row, a[0], b[0] - 1, this.state.fillStyle);
  }
  strokeRect(x, y, w, h) { const r = this.state.lineWidth / 2; const old = this.state.fillStyle; this.state.fillStyle = this.state.strokeStyle; this.fillRect(x - r, y - r, w + 2 * r, 2 * r); this.fillRect(x - r, y + h - r, w + 2 * r, 2 * r); this.fillRect(x - r, y, 2 * r, h); this.fillRect(x + w - r, y, 2 * r, h); this.state.fillStyle = old; }
  fontSize() { return Number(this.state.font.match(/([\d.]+)px/)?.[1] || 12); }
  measureText(text) { return { width: Array.from(text).length * this.fontSize() * 0.65 }; }
  text(text, x, y, stroke) {
    const size = this.fontSize(), unit = size / 8, width = this.measureText(text).width;
    let left = x - (this.state.textAlign === 'center' ? width / 2 : this.state.textAlign === 'right' ? width : 0);
    const old = this.state.fillStyle;
    if (stroke) this.state.fillStyle = this.state.strokeStyle;
    const pad = stroke ? this.state.lineWidth / 2 : 0;
    for (const char of text) {
      const glyph = GLYPHS[char] || (char === ' ' ? null : GLYPHS['?']);
      if (glyph) glyph.forEach((row, gy) => Array.from(row).forEach((bit, gx) => { if (bit === '1') this.fillRect(left + gx * unit - pad, y - size * 0.9 + gy * unit - pad, unit + pad * 2 + 0.5, unit + pad * 2 + 0.5); }));
      left += size * 0.65;
    }
    this.state.fillStyle = old;
  }
  fillText(text, x, y) { this.text(text, x, y, false); }
  strokeText(text, x, y) { this.text(text, x, y, true); }
}
for (const key of ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign']) Object.defineProperty(RasterContext.prototype, key, { get() { return this.state[key]; }, set(value) { this.state[key] = value; } });
function intersections(points, y) {
  const hits = [];
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
  return hits.sort((a, b) => a - b);
}
