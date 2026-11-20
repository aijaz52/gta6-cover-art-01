import { DEFAULTS, MAX_CAPTION, PALETTES, normalizeCaption, normalizeOptions, renderCover, exportFilename } from './cover.js';

const $ = id => document.getElementById(id);
const canvas = $('cover');
let state = { ...DEFAULTS };
let photo = null;
let photoUrl = null;
let uploadGeneration = 0;
let exporting = false;
let frame = 0;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

function paint() {
  frame = 0;
  try {
    renderCover(canvas, state, photo);
    canvas.setAttribute('aria-label', `${state.caption || 'Untitled'} cover, ${state.layout === 'classic' ? 'four diagonal panels' : 'four split panels'}, ${PALETTES[state.palette].name}${photo ? ', using your uploaded photo' : ', original illustrated city, character, boat and car'}`);
  } catch (error) { status(`Could not render the cover: ${error.message}`, true); }
}
function schedulePaint() { if (!frame) frame = requestAnimationFrame(paint); }

function syncControls() {
  $('caption').value = state.caption;
  $('caption-count').textContent = `${Array.from(state.caption).length} / ${MAX_CAPTION}`;
  for (const input of document.querySelectorAll('input[name="layout"]')) input.checked = input.value === state.layout;
  for (const input of document.querySelectorAll('input[name="palette"]')) input.checked = input.value === state.palette;
  $('grain').checked = state.grain;
  $('zoom').value = state.zoom; $('zoom-value').value = `${Math.round(state.zoom * 100)}%`;
  $('pan-x').value = state.panX; $('pan-y').value = state.panY;
  $('photo-controls').hidden = !photo;
}

function clearPhoto() {
  uploadGeneration++;
  photo = null;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  $('photo-input').value = '';
  $('upload-title').textContent = 'Drop your photo here';
  $('upload-detail').replaceChildren(document.createTextNode('or '), Object.assign(document.createElement('u'), { textContent: 'browse files' }), document.createTextNode(' to get started'));
  $('photo-controls').hidden = true;
  state.zoom = 1; state.panX = 0; state.panY = 0;
}

async function loadPhoto(file) {
  if (!file) return;
  const generation = ++uploadGeneration;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { status('Choose a JPG, PNG or WebP image. Your current cover is still here.', true); return; }
  if (file.size > 20 * 1024 * 1024) { status('That photo is over 20 MB. Choose a smaller image and try again.', true); return; }
  const url = URL.createObjectURL(file);
  status('Opening your photo…');
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (generation !== uploadGeneration) { URL.revokeObjectURL(url); return; }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64_000_000) throw new Error('Choose an image with fewer than 64 million pixels.');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = url; photo = image;
    state.zoom = 1; state.panX = 0; state.panY = 0;
    $('upload-title').textContent = file.name;
    $('upload-detail').textContent = `${image.naturalWidth} × ${image.naturalHeight} · click to replace`;
    syncControls(); schedulePaint();
    status('Your photo is in. Tune the crop, set the mood, make it yours.');
  } catch (error) {
    URL.revokeObjectURL(url);
    if (generation === uploadGeneration) status(`Could not open that image. ${error.message || 'Try another file.'}`, true);
  }
}

async function exportPNG() {
  if (exporting) return;
  exporting = true;
  const button = $('export-button'); button.disabled = true; button.querySelector('span').textContent = 'Exporting…';
  status('Putting the finishing touches on your PNG…');
  try {
    await document.fonts.ready;
    const output = document.createElement('canvas');
    output.width = Number($('resolution').value); output.height = output.width * 1.25;
    renderCover(output, { ...state }, photo);
    const blob = await new Promise((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('The browser could not encode the PNG.')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportFilename(state.caption);
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    output.width = 1; output.height = 1;
    status(`Cover exported. ${Number($('resolution').value)} × ${Number($('resolution').value) * 1.25} px of main character energy.`);
  } catch (error) { status(`Export failed: ${error.message} Try the standard resolution.`, true); }
  finally { exporting = false; button.disabled = false; button.querySelector('span').textContent = 'Export cover'; }
}

$('photo-input').addEventListener('change', event => loadPhoto(event.target.files?.[0]));
const dropZone = $('drop-zone');
for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragover'); });
for (const type of ['dragleave', 'drop']) dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', event => loadPhoto(event.dataTransfer?.files?.[0]));
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
$('caption').addEventListener('input', event => {
  const raw = event.target.value;
  const limited = Array.from(raw).slice(0, MAX_CAPTION).join('');
  if (raw !== limited) event.target.value = limited;
  state.caption = normalizeCaption(limited);
  $('caption-count').textContent = `${Array.from(limited).length} / ${MAX_CAPTION}`;
  schedulePaint();
});
for (const name of ['layout', 'palette']) for (const input of document.querySelectorAll(`input[name="${name}"]`)) input.addEventListener('change', () => { state[name] = input.value; schedulePaint(); });
$('grain').addEventListener('change', event => { state.grain = event.target.checked; schedulePaint(); });
for (const [id, key] of [['zoom', 'zoom'], ['pan-x', 'panX'], ['pan-y', 'panY']]) $(id).addEventListener('input', event => { state[key] = Number(event.target.value); $('zoom-value').value = `${Math.round(state.zoom * 100)}%`; schedulePaint(); });
$('demo-button').addEventListener('click', () => { clearPhoto(); syncControls(); schedulePaint(); status('Back to our original illustration. Your caption and style are still yours.'); });
$('reset-button').addEventListener('click', () => {
  clearPhoto(); state = normalizeOptions(DEFAULTS); syncControls(); $('resolution').value = '1200'; updateResolution(); schedulePaint(); status('A fresh canvas. Where are we headed next?');
});
function updateResolution() { const width = Number($('resolution').value); $('export-meta').textContent = `${width} × ${width * 1.25} px · PNG · no watermark`; }
$('resolution').addEventListener('change', updateResolution);
$('export-button').addEventListener('click', exportPNG);
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); exportPNG(); } });
const dialog = $('help-dialog');
$('help-button').addEventListener('click', () => dialog.showModal());
for (const id of ['close-help', 'help-done']) $(id).addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
syncControls(); paint();
document.fonts.ready.then(schedulePaint);
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { /* The local server works without a cache too. */ });
