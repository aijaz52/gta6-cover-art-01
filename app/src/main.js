import {WIDTH, HEIGHT, DEFAULT_CAPTION, drawCover, exportName} from './cover.js';

const byId = id => document.getElementById(id);
const preview = byId('preview');
const context = preview.getContext('2d', {alpha:false});
const caption = byId('caption');
const zoom = byId('zoom');
const photo = byId('photo');
const drop = byId('drop');
const demo = byId('demo');
const download = byId('download');
const size = byId('size');
const status = byId('status');
let image = null;
let revision = 0;
let pendingFrame = 0;

function options() {
  const checked = name => document.querySelector(`input[name="${name}"]:checked`).value;
  return {image, caption:caption.value, layout:checked('layout'), palette:checked('palette'), zoom:Number(zoom.value)};
}

function refresh() {
  byId('count').textContent = `${caption.value.length} / ${caption.maxLength}`;
  byId('zoom-value').textContent = `${Number(zoom.value).toFixed(2)}×`;
  const text = caption.value.trim();
  preview.setAttribute('aria-label', text ? `Cover preview: ${text}` : 'Untitled cover preview');
  if (!pendingFrame) pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    drawCover(context, options());
  });
}

async function loadPhoto(file) {
  if (!file) return;
  const current = ++revision;
  if (file.size > 25 * 1024 * 1024 || !/^image\/(jpeg|png|webp|avif|gif|bmp|x-ms-bmp)$/i.test(file.type)) {
    status.textContent = 'Choose a supported image under 25 MB.';
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    status.textContent = 'Opening photo…';
    const next = new Image();
    next.src = url;
    await next.decode();
    if (current !== revision) return;
    if (!next.naturalWidth || next.naturalWidth * next.naturalHeight > 48_000_000) {
      status.textContent = 'Choose a photo under 48 megapixels.';
      return;
    }
    image = next;
    zoom.value = '1';
    byId('photo-name').textContent = file.name;
    byId('zoom-row').hidden = false;
    demo.disabled = false;
    status.textContent = 'Photo ready.';
    refresh();
  } catch {
    if (current === revision) status.textContent = 'This image could not be opened.';
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clearPhoto() {
  revision++;
  image = null;
  photo.value = '';
  zoom.value = '1';
  byId('photo-name').textContent = 'Choose or drop a photo';
  byId('zoom-row').hidden = true;
  demo.disabled = true;
  status.textContent = '';
  refresh();
}

photo.addEventListener('change', () => {
  const [file] = photo.files;
  photo.value = '';
  void loadPhoto(file);
});
for (const event of ['dragenter','dragover']) drop.addEventListener(event, e => {
  e.preventDefault(); drop.classList.add('dragging');
});
drop.addEventListener('dragleave', e => {
  if (!e.relatedTarget || !drop.contains(e.relatedTarget)) drop.classList.remove('dragging');
});
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('dragging');
  void loadPhoto(e.dataTransfer.files[0]);
});
demo.addEventListener('click', () => { clearPhoto(); photo.focus(); });
byId('reset').addEventListener('click', () => {
  clearPhoto();
  caption.value = DEFAULT_CAPTION;
  document.querySelector('[value="skyline"]').checked = true;
  document.querySelector('[value="sunset"]').checked = true;
  size.value = '2';
  refresh();
});
caption.addEventListener('input', refresh);
zoom.addEventListener('input', refresh);
document.querySelectorAll('input[type="radio"]').forEach(control => control.addEventListener('change', refresh));

download.addEventListener('click', async () => {
  download.disabled = true;
  status.textContent = 'Rendering PNG…';
  const settings = options();
  const scale = Number(size.value);
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const output = document.createElement('canvas');
    output.width = WIDTH * scale;
    output.height = HEIGHT * scale;
    drawCover(output.getContext('2d', {alpha:false}), settings);
    const png = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG encoding failed');
    const url = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportName(settings.caption);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    status.textContent = 'PNG ready.';
  } catch {
    status.textContent = 'Export failed. Try a smaller PNG size.';
  } finally {
    download.disabled = false;
  }
});

refresh();
