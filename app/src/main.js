(function () {
  'use strict';
  const Studio = globalThis.ViceCover;
  const byId = id => document.getElementById(id);
  const canvas = byId('cover');
  const status = byId('status');
  const exportButton = byId('export');
  const controls = { caption: byId('caption'), tagline: byId('tagline'), zoom: byId('zoom'), focusX: byId('focus-x'), focusY: byId('focus-y'), intensity: byId('intensity'), grain: byId('grain') };
  const state = { ...Studio.DEFAULTS };
  let photo = null;
  let loadSequence = 0;
  let frame = 0;
  let exporting = false;

  function announce(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }
  function paint() {
    frame = 0;
    try {
      Studio.renderCover(canvas, photo, state);
      canvas.setAttribute('aria-label', `${state.caption || 'Untitled story'}, ${Studio.LAYOUTS[state.layout].name} multi-panel cover in ${Studio.PALETTES[state.palette].name} colors`);
    } catch (error) {
      announce(`Couldn't draw the cover: ${error.message}`, true);
    }
  }
  function schedulePaint() { if (!frame) frame = requestAnimationFrame(paint); }
  function updateSelection(attribute, value) {
    document.querySelectorAll(`[data-${attribute}]`).forEach(button => {
      const selected = button.dataset[attribute] === value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function setSampleSelection(name) {
    document.querySelectorAll('[data-sample]').forEach(button => {
      const active = button.dataset.sample === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function syncControls() {
    controls.caption.value = state.caption;
    controls.tagline.value = state.tagline;
    controls.zoom.value = state.zoom * 100;
    controls.focusX.value = state.focusX * 100;
    controls.focusY.value = state.focusY * 100;
    controls.intensity.value = state.intensity * 100;
    controls.grain.checked = state.grain;
    byId('zoom-value').value = `${Math.round(state.zoom * 100)}%`;
    byId('intensity-value').value = `${Math.round(state.intensity * 100)}%`;
    byId('caption-count').textContent = `${state.caption.length} / 48`;
    byId('preview-layout').textContent = `${Studio.LAYOUTS[state.layout].name.toUpperCase()} / ${Studio.LAYOUTS[state.layout].panels.length} PANELS`;
    updateSelection('layout', state.layout);
    updateSelection('palette', state.palette);
  }
  async function decodePhoto(url) {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image format could not be opened. Try a JPG, PNG, or WEBP.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('The photo has no readable image data.');
    if (image.naturalWidth * image.naturalHeight > 65000000) throw new Error('This photo is too large to edit safely. Choose an image under 65 megapixels.');
    // Prepare ink contours once, rather than processing pixels on every slider move.
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const prepared = document.createElement('canvas');
    prepared.width = Math.max(1, Math.round(image.naturalWidth * scale));
    prepared.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = prepared.getContext('2d', { willReadFrequently: true });
    context.filter = 'blur(0.35px)';
    context.drawImage(image, 0, 0, prepared.width, prepared.height);
    context.filter = 'none';
    const pixels = context.getImageData(0, 0, prepared.width, prepared.height);
    pixels.data.set(Studio.illustratePixels(pixels.data, prepared.width, prepared.height));
    context.putImageData(pixels, 0, 0);
    return prepared;
  }
  async function loadSample(name) {
    const sequence = ++loadSequence;
    if (location.protocol === 'file:') {
      photo = null;
      setSampleSelection(null);
      byId('file-name').textContent = 'Original illustrated cover';
      announce('Choose a photo to get started. Run node serve.ts to use the bundled sample photos.');
      schedulePaint();
      return;
    }
    const label = name === 'pier' ? 'The pier' : 'Boulevard';
    announce(`Opening ${label}…`);
    try {
      const image = await decodePhoto(`./samples/${name}.jpg`);
      if (sequence !== loadSequence) return;
      photo = image;
      setSampleSelection(name);
      byId('file-name').textContent = `Sample: ${label}`;
      byId('photo').value = '';
      announce('Your cover is ready. Everything stays on this device.');
      schedulePaint();
    } catch (error) {
      if (sequence !== loadSequence) return;
      announce('Sample unavailable. The illustrated cover is ready; choose a photo to make it yours.');
      schedulePaint();
    }
  }
  async function loadFile(file) {
    if (!file) return;
    // Invalid files do not disturb the last successfully loaded photo.
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      announce('Choose a raster photo, such as JPG, PNG, or WEBP. SVG files are not supported.', true);
      return;
    }
    if (file.size > 25 * 1024 * 1024) { announce('That photo is over 25 MB. Please choose a smaller file.', true); return; }
    const sequence = ++loadSequence;
    const url = URL.createObjectURL(file);
    announce('Developing your cover…');
    try {
      const image = await decodePhoto(url);
      if (sequence !== loadSequence) return;
      photo = image;
      setSampleSelection(null);
      byId('file-name').textContent = file.name;
      state.focusX = .5;state.focusY = .5;state.zoom = 1;
      syncControls();
      schedulePaint();
      announce('Photo loaded. Pick a layout, adjust your title, and make it yours.');
    } catch (error) {
      if (sequence === loadSequence) announce(error.message, true);
    } finally { URL.revokeObjectURL(url); }
  }
  Object.entries(controls).forEach(([key, control]) => {
    control.addEventListener('input', () => {
      state[key] = key === 'grain' ? control.checked : ['zoom', 'focusX', 'focusY', 'intensity'].includes(key) ? Number(control.value) / 100 : control.value;
      byId('caption-count').textContent = `${state.caption.length} / 48`;
      byId('zoom-value').value = `${Math.round(state.zoom * 100)}%`;
      byId('intensity-value').value = `${Math.round(state.intensity * 100)}%`;
      schedulePaint();
    });
  });
  ['layout', 'palette'].forEach(key => document.querySelectorAll(`[data-${key}]`).forEach(button => {
    button.addEventListener('click', () => {
      state[key] = button.dataset[key];
      updateSelection(key, state[key]);
      byId('preview-layout').textContent = `${Studio.LAYOUTS[state.layout].name.toUpperCase()} / ${Studio.LAYOUTS[state.layout].panels.length} PANELS`;
      schedulePaint();
    });
  }));
  document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => loadSample(button.dataset.sample)));
  byId('photo').addEventListener('change', event => loadFile(event.target.files[0]));
  const dropZone = byId('drop-zone');
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', event => { event.preventDefault();dragDepth++;dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragover', event => { event.preventDefault();event.dataTransfer.dropEffect = 'copy'; });
  dropZone.addEventListener('dragleave', event => { event.preventDefault();if (--dragDepth <= 0) { dragDepth = 0;dropZone.classList.remove('dragging'); } });
  dropZone.addEventListener('drop', event => { event.preventDefault();dragDepth = 0;dropZone.classList.remove('dragging');loadFile(event.dataTransfer.files[0]); });
  // Keep a missed drop from navigating away and losing the current cover.
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  byId('reset').addEventListener('click', () => {
    Object.assign(state, Studio.DEFAULTS);
    syncControls();
    schedulePaint();
    loadSample('boulevard');
  });
  exportButton.addEventListener('click', async () => {
    if (exporting) return;
    exporting = true;exportButton.disabled = true;
    announce('Preparing your full-resolution PNG…');
    let url;
    try {
      const output = document.createElement('canvas');
      output.width = Studio.WIDTH;output.height = Studio.HEIGHT;
      const snapshot = { ...state };
      Studio.renderCover(output, photo, snapshot);
      const blob = await new Promise((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed. Please try again.')), 'image/png'));
      url = URL.createObjectURL(blob);
      const download = document.createElement('a');
      download.href = url;download.download = Studio.filenameFor(snapshot.caption);
      document.body.append(download);download.click();download.remove();
      const completedUrl = url;
      setTimeout(() => URL.revokeObjectURL(completedUrl), 60000);
      url = null;
      announce('PNG exported · 1200 × 1500 pixels · Your legend is ready.');
    } catch (error) { announce(`Export failed: ${error.message}`, true); }
    finally { if (url) URL.revokeObjectURL(url);exporting = false;exportButton.disabled = false; }
  });
  if (location.protocol === 'file:') {
    document.querySelectorAll('[data-sample]').forEach(button => {
      button.disabled = true;
      button.title = 'Bundled samples need the local server. Uploading your own photo works here.';
    });
  }
  syncControls();
  paint();
  loadSample('boulevard');
})();
