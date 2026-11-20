export const WIDTH = 960;
export const HEIGHT = 1200;
export const DEFAULT_CAPTION = 'VICE AFTER DARK';

export const layouts = {
  skyline: [
    [[0,0],[620,0],[535,435],[0,355]], [[620,0],[960,0],[960,380],[535,435]],
    [[0,355],[535,435],[960,380],[960,792],[440,842],[0,885]],
    [[0,885],[440,842],[490,1200],[0,1200]], [[440,842],[960,792],[960,1200],[490,1200]],
  ],
  crossfire: [
    [[0,0],[960,0],[960,280],[390,357],[0,410]], [[0,410],[390,357],[525,810],[0,760]],
    [[390,357],[960,280],[960,868],[525,810]],
    [[0,760],[525,810],[410,1200],[0,1200]], [[525,810],[960,868],[960,1200],[410,1200]],
  ],
  strip: [
    [[0,0],[960,0],[960,226],[490,278],[0,332]], [[0,332],[490,278],[590,710],[0,635]],
    [[490,278],[960,226],[960,757],[590,710]],
    [[0,635],[590,710],[960,757],[960,960],[0,1050]], [[0,1050],[960,960],[960,1200],[0,1200]],
  ],
};

export const palettes = {
  sunset: ['#ff9d68','#f474a0','#ffc984','#63d6c2','#c085db'],
  lagoon: ['#79ddc6','#78cddd','#feb984','#a5de9b','#5e8edb'],
  nocturne: ['#bd80ff','#f367a2','#877df1','#55bbef','#ff986b'],
};

export function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([,y]) => y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y};
}

export function crop(sw, sh, w, h, zoom = 1, fx = .5, fy = .5) {
  const scale = Math.max(w / sw, h / sh) * Math.max(1, zoom);
  const dw = w / scale, dh = h / scale;
  const place = (extent, size, focus) => Math.max(0, Math.min(extent - size, extent * focus - size / 2));
  return [place(sw, dw, fx), place(sh, dh, fy), dw, dh];
}

export function captionLines(caption) {
  const words = caption.trim().replace(/\s+/gu, ' ').toUpperCase().split(' ').filter(Boolean);
  if (words.length < 2) return words;
  let best = [words.join(' ')], score = Infinity;
  for (let split = 1; split < words.length; split++) {
    const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
    const lengths = candidate.map(line => Array.from(line).length);
    const cost = Math.max(...lengths) + Math.abs(lengths[0] - lengths[1]) * .3;
    if (cost < score) { best = candidate; score = cost; }
  }
  return best;
}

export function exportName(caption) {
  const slug = caption.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '');
  return `${slug || 'vice-cover'}.png`;
}

function shape(ctx, points, color) {
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
}

function disk(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

function palm(ctx, x, y, size, flip = 1) {
  ctx.save(); ctx.translate(x,y); ctx.scale(size * flip,size);
  const ink = '#211329';
  shape(ctx, [[-10,140],[10,140],[3,72],[-9,-1],[-16,4],[-7,78]], ink);
  for (const [dx, dy] of [[-109,19],[-88,-31],[-53,-61],[14,-67],[70,-44],[95,-3],[70,43]]) {
    ctx.beginPath(); ctx.moveTo(-12,6);
    ctx.quadraticCurveTo(dx * .55,dy - 28,dx,dy);
    ctx.quadraticCurveTo(dx * .62,dy - 5,-12,14);
    ctx.fillStyle = ink; ctx.fill();
  }
  ctx.restore();
}

function illustration(ctx, box, i, tint) {
  ctx.save(); ctx.translate(box.x,box.y); ctx.scale(box.w / 480,box.h / 300);
  const sky = ctx.createLinearGradient(0,0,0,300);
  sky.addColorStop(0,'#39204f'); sky.addColorStop(.67,tint); sky.addColorStop(1,'#fdd3a0');
  ctx.fillStyle = sky; ctx.fillRect(0,0,480,300);
  disk(ctx, [355,248,352,165,310][i], 111, 64, '#ffdea2');
  ctx.fillStyle = tint;
  for (let y = 120; y < 172; y += 10) ctx.fillRect(0,y,480,2 + (y-120)/14);
  for (let j = 0; j < 25; j++) {
    const x = j * 21 - 10, h = 12 + (j * 37 + i * 49) % 73;
    ctx.fillStyle = j % 2 ? '#6b3c62' : '#55334f'; ctx.fillRect(x,201-h,17,h);
    ctx.fillStyle = '#dfa285';
    for (let y = 208 - h; y < 194; y += 9) ctx.fillRect(x + 4,y,3,2);
  }
  ctx.fillStyle = '#36213f'; ctx.fillRect(0,200,480,100);
  for (let j = 0; j < 16; j++) {
    const x = (j * 113 + i * 39) % 475, y = 207 + (j * 17) % 89;
    ctx.fillStyle = j % 3 ? '#694261' : tint; ctx.fillRect(x,y,21 + j % 6 * 5,2);
  }
  if (i === 0 || i === 1) {
    palm(ctx,i === 0 ? 84 : 344,113,1.34,i === 0 ? 1 : -1);
    palm(ctx,i === 0 ? 166 : 421,161,.79,-1);
  } else if (i === 2 || i === 4) {
    palm(ctx,49,96,1.58); palm(ctx,452,127,1.24,-1);
    const dx = i === 2 ? 115 : 80, dy = i === 2 ? 187 : 231;
    ctx.translate(dx,dy);
    shape(ctx, [[0,51],[22,22],[80,13],[112,-12],[193,-10],[228,16],[268,24],[281,54],[269,68],[12,68]], '#201626');
    shape(ctx, [[10,48],[30,29],[88,21],[116,-5],[189,-3],[222,22],[262,31],[272,48],[200,56],[27,58]], tint);
    shape(ctx, [[96,20],[121,0],[182,2],[211,22]], '#362644');
    shape(ctx, [[11,49],[72,43],[68,49],[17,54]], '#ffefc7');
    ctx.fillStyle = '#ff674c'; ctx.fillRect(239,36,30,6);
    for (const x of [62,217]) { disk(ctx,x,61,19,'#17131e'); disk(ctx,x,61,9,'#a4859c'); }
  } else {
    shape(ctx, [[71,247],[179,221],[326,198],[380,200],[334,239],[160,255]], '#1d172c');
    shape(ctx, [[90,243],[204,232],[303,212],[365,201],[319,227],[155,249]], '#ffefe0');
    shape(ctx, [[195,229],[222,201],[265,197],[286,215]], tint);
  }
  ctx.restore();
}

const crops = [[.25,.29,1.13],[.73,.27,1.48],[.5,.5,1],[.27,.75,1.54],[.76,.68,1.23]];

export function drawCover(ctx, {image = null, caption = DEFAULT_CAPTION, layout = 'skyline', palette = 'sunset', zoom = 1} = {}) {
  const panels = Object.hasOwn(layouts, layout) ? layouts[layout] : layouts.skyline;
  const colors = Object.hasOwn(palettes, palette) ? palettes[palette] : palettes.sunset;
  ctx.save(); ctx.scale(ctx.canvas.width / WIDTH, ctx.canvas.height / HEIGHT);
  ctx.fillStyle = '#1a1122'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  panels.forEach((points, i) => {
    const {x,y,w,h} = bounds(points);
    ctx.save(); shape(ctx, points); ctx.clip();
    if (image) {
      const [fx,fy,z] = crops[i];
      const source = crop(image.naturalWidth, image.naturalHeight,w,h,z*zoom,fx,fy);
      ctx.filter = 'contrast(1.17) saturate(.78)';
      ctx.drawImage(image,...source,x,y,w,h); ctx.filter = 'none';
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = colors[i]; ctx.fillRect(x,y,w,h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .17; ctx.fillRect(x,y,w,h); ctx.globalAlpha = 1;
    } else illustration(ctx,{x,y,w,h},i,colors[i]);
    const wash = ctx.createLinearGradient(0,y,0,y+h);
    wash.addColorStop(0,'#24133000'); wash.addColorStop(1,'#1b102662');
    ctx.fillStyle = wash; ctx.fillRect(x,y,w,h);
    for (let j = 0; j < 1100; j++) {
      const dx = (j * 173.631 + i * 7) % w, dy = (j * 97.379) % h;
      ctx.fillStyle = j % 2 ? '#fff4dc20' : '#1a102c23';
      ctx.fillRect(x+dx,y+dy,2 + j % 3,2);
    }
    ctx.restore();
    shape(ctx, points); ctx.strokeStyle = '#1a1122'; ctx.lineWidth = 13; ctx.lineJoin = 'round'; ctx.stroke();
  });
  ctx.strokeStyle = '#1a1122'; ctx.lineWidth = 26; ctx.strokeRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle = '#fff0d893'; ctx.lineWidth = 2; ctx.strokeRect(22,22,WIDTH-44,HEIGHT-44);

  const lines = captionLines(caption);
  if (lines.length) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const font = size => `italic 900 ${size}px Impact, 'Arial Black', system-ui, sans-serif`;
    const base = lines.length === 1 ? 144 : 151;
    ctx.font = font(base);
    const preferred = lines.map(line => Math.max(1, Math.floor(base * Math.min(1, 776 / ctx.measureText(line).width))));
    const sizes = preferred.map(size => Math.min(size, Math.ceil(Math.min(...preferred) * 1.5)));
    const step = Math.min(139, (sizes[0] + (sizes[1] ?? 0)) * .43 + 14);
    lines.forEach((line, i) => {
      const size = sizes[i];
      ctx.font = font(size);
      const y = 610 + (i - (lines.length - 1) / 2) * step;
      ctx.lineWidth = 26; ctx.strokeStyle = '#1a1122'; ctx.strokeText(line,484,y+13);
      ctx.strokeStyle = '#1a1122'; ctx.lineWidth = 22; ctx.strokeText(line,480,y);
      ctx.strokeStyle = colors[1]; ctx.lineWidth = 5; ctx.strokeText(line,480,y+3);
      const fill = ctx.createLinearGradient(0,y-size*.44,0,y+size*.34);
      fill.addColorStop(0,'#fff8de'); fill.addColorStop(.56,'#fff0cb'); fill.addColorStop(1,colors[0]);
      ctx.fillStyle = fill; ctx.fillText(line,480,y);
    });
  }
  ctx.restore();
}
