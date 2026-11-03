'use strict';
const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const viewer = $('viewer');
const stage = $('canvas-stage');
const zoomLabel = $('zoom-label');
const MIN_ZOOM = .25, MAX_ZOOM = 8;
const DEFAULTS = {brightness: 0, contrast: 0, threshold: 0, method: 'none', dotsize: 4, intensity: 50, mirrored: false};
const state = {...DEFAULTS, img: null, name: '', history: [], future: [], gesture: false, comparing: false, raf: 0, zoom: 1, panX: 0, panY: 0, zoomMode: 'fit', activeTool: 'brush', spaceDown: false, renderMs: 0, renderMode: 'rgb'};

function status(message) { $('status').textContent = message; }
function snapshot() {
  const {brightness, contrast, threshold, method, dotsize, intensity, mirrored} = state;
  return {brightness, contrast, threshold, method, dotsize, intensity, mirrored};
}
function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 50) state.history.shift();
  state.future = [];
  updateHistory();
}
function updateHistory() {
  $('undo').disabled = !state.img || !state.history.length;
  $('redo').disabled = !state.img || !state.future.length;
}
function undo() { if (state.history.length) { state.future.push(snapshot()); apply(state.history.pop()); } }
function redo() { if (state.future.length) { state.history.push(snapshot()); apply(state.future.pop()); } }
function apply(s) { Object.assign(state, s); syncControls(); render(); status('Change applied.'); }

const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

function importImage(file, source = 'input') {
  if (source === 'drop' && state.gesture) {
    status('Finish the current edit before importing another image.');
    return;
  }
  if (!file) {
    status('No image was selected. Nothing changed.');
    return;
  }
  const looksLikeImage = IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXTENSIONS.test(file.name));
  if (!looksLikeImage) {
    status('That file is not a PNG, JPG, or WebP image. Nothing changed.');
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    status('Image is larger than 30 MB. Nothing changed.');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (!img.naturalWidth || !img.naturalHeight) {
      status('Could not read this image. Nothing changed.');
      return;
    }
    Object.assign(state, DEFAULTS, {img, name: file.name, history: [], future: [], gesture: false, comparing: false});
    canvas.style.display = 'block';
    $('empty').hidden = true;
    $('preview-label').textContent = file.name;
    syncControls(); render(); fitToView();
    status('Image ready. Adjust, then export for stencil transfer.');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    status('Could not read this image. Nothing changed.');
  };
  img.src = url;
}

$('file').onchange = event => {
  const file = event.target.files[0];
  event.target.value = '';
  importImage(file);
};

let dragDepth = 0;
viewer.addEventListener('dragenter', event => {
  event.preventDefault();
  dragDepth++;
  viewer.classList.add('is-dragover');
});
viewer.addEventListener('dragover', event => {
  event.preventDefault();
  event.dataTransfer.dropEffect = state.gesture ? 'none' : 'copy';
});
viewer.addEventListener('dragleave', event => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) viewer.classList.remove('is-dragover');
});
viewer.addEventListener('drop', event => {
  event.preventDefault();
  dragDepth = 0;
  viewer.classList.remove('is-dragover');
  importImage(event.dataTransfer.files[0], 'drop');
});

function render(original = false) {
  if (!state.img) return;
  const t0 = performance.now();
  const {img} = state;
  if (canvas.width !== img.width) { canvas.width = img.width; canvas.height = img.height; }
  const dithering = !original && state.method !== 'none';
  const thresholding = !original && !dithering && state.threshold > 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = original ? 'none' : `brightness(${1 + state.brightness / 100}) contrast(${1 + state.contrast / 100})`;
  if (dithering || thresholding) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (!original && state.mirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  if (dithering) applyDither(state.method, state.dotsize, state.intensity);
  else if (thresholding) applyThreshold(state.threshold * 2.55);
  state.renderMs = Math.round(performance.now() - t0);
  state.renderMode = original ? 'source' : ((dithering || thresholding) ? '1-bit' : 'rgb');
  updateImageInfo();
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function updateImageInfo() {
  if (!state.img) {
    $('image-info').textContent = '—';
    return;
  }
  $('image-info').textContent = `${state.img.width} × ${state.img.height} · ${state.renderMode} · ${state.renderMs} ms · ${Math.round(state.zoom * 100)}%`;
}

function fitZoomValue() {
  if (!state.img) return 1;
  const rect = viewer.getBoundingClientRect();
  return clamp(Math.min((rect.width - 56) / state.img.width, (rect.height - 56) / state.img.height), MIN_ZOOM, MAX_ZOOM);
}

function applyViewTransform() {
  if (!state.img) return;
  const rect = viewer.getBoundingClientRect();
  stage.style.width = `${canvas.width}px`;
  stage.style.height = `${canvas.height}px`;
  stage.style.transform = `translate(${rect.width / 2 + state.panX}px, ${rect.height / 2 + state.panY}px) scale(${state.zoom}) translate(${-canvas.width / 2}px, ${-canvas.height / 2}px)`;
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  updateImageInfo();
  syncZoomControls();
}

function syncZoomControls() {
  $('zoom-out').disabled = !state.img || state.zoom <= MIN_ZOOM + .0001;
  $('zoom-in').disabled = !state.img || state.zoom >= MAX_ZOOM - .0001;
  $('zoom-fit').disabled = !state.img;
}

function fitToView() {
  if (!state.img) return;
  state.zoom = fitZoomValue();
  state.panX = state.panY = 0;
  state.zoomMode = 'fit';
  applyViewTransform();
}

function setZoom(nextZoom, clientX, clientY, manual = true) {
  if (!state.img) return;
  const rect = viewer.getBoundingClientRect();
  const x = (clientX ?? rect.left + rect.width / 2) - rect.left;
  const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
  const oldZoom = state.zoom;
  const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(next - oldZoom) < .00001) return;
  const imageOffsetX = (x - rect.width / 2 - state.panX) / oldZoom;
  const imageOffsetY = (y - rect.height / 2 - state.panY) / oldZoom;
  state.panX = x - rect.width / 2 - imageOffsetX * next;
  state.panY = y - rect.height / 2 - imageOffsetY * next;
  state.zoom = next;
  if (manual) state.zoomMode = 'manual';
  applyViewTransform();
}

function selectTool(tool) {
  state.activeTool = tool;
  $('brush-tool').setAttribute('aria-pressed', String(tool === 'brush'));
  $('hand-tool').setAttribute('aria-pressed', String(tool === 'hand'));
  updateViewerCursor();
  status(tool === 'hand' ? 'Hand tool active. Drag to pan.' : 'Brush tool active.');
}

function updateViewerCursor() {
  viewer.classList.toggle('is-pan-ready', Boolean(state.img) && (state.activeTool === 'hand' || state.spaceDown));
}

$('zoom-out').onclick = () => setZoom(state.zoom / 1.25);
$('zoom-in').onclick = () => setZoom(state.zoom * 1.25);
$('zoom-fit').onclick = () => { fitToView(); status('Artwork fit to view.'); };
$('brush-tool').onclick = () => selectTool('brush');
$('hand-tool').onclick = () => selectTool('hand');

viewer.addEventListener('wheel', event => {
  if (!state.img) return;
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * .0015);
  setZoom(state.zoom * factor, event.clientX, event.clientY);
}, {passive: false});

viewer.addEventListener('dblclick', event => {
  if (!state.img || event.target.closest('button')) return;
  fitToView();
  status('Artwork fit to view.');
});

let panSession = null;
let pinchSession = null;
let lastTap = null;
const pointers = new Map();

function beginPan(pointerId, x, y) {
  panSession = {pointerId, x, y, startPanX: state.panX, startPanY: state.panY};
  viewer.classList.add('is-panning');
}

function beginPinch() {
  panSession = null;
  const [a, b] = [...pointers.values()];
  const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
  const rect = viewer.getBoundingClientRect();
  const imageOffsetX = (midX - rect.left - rect.width / 2 - state.panX) / state.zoom;
  const imageOffsetY = (midY - rect.top - rect.height / 2 - state.panY) / state.zoom;
  pinchSession = {distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom, imageOffsetX, imageOffsetY};
}

viewer.addEventListener('pointerdown', event => {
  if (!state.img || event.target.closest('button') || event.button === 2) return;
  event.preventDefault();
  viewer.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY});
  if (pointers.size === 2) beginPinch();
  else if (state.activeTool === 'hand' || state.spaceDown || event.button === 1) beginPan(event.pointerId, event.clientX, event.clientY);
});

viewer.addEventListener('pointermove', event => {
  const point = pointers.get(event.pointerId);
  if (!point) return;
  const oldX = point.x, oldY = point.y;
  point.x = event.clientX; point.y = event.clientY;
  if (pointers.size >= 2 && pinchSession) {
    const [a, b] = [...pointers.values()];
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const nextZoom = clamp(pinchSession.zoom * distance / Math.max(1, pinchSession.distance), MIN_ZOOM, MAX_ZOOM);
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const rect = viewer.getBoundingClientRect();
    state.zoom = nextZoom;
    state.panX = midX - rect.left - rect.width / 2 - pinchSession.imageOffsetX * nextZoom;
    state.panY = midY - rect.top - rect.height / 2 - pinchSession.imageOffsetY * nextZoom;
    state.zoomMode = 'manual';
    applyViewTransform();
  } else if (panSession && panSession.pointerId === event.pointerId) {
    state.panX = panSession.startPanX + event.clientX - panSession.x;
    state.panY = panSession.startPanY + event.clientY - panSession.y;
    applyViewTransform();
  }
});

function finishPointer(event) {
  const point = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (panSession?.pointerId === event.pointerId) panSession = null;
  if (pointers.size < 2) pinchSession = null;
  if (!pointers.size) viewer.classList.remove('is-panning');
  if (event.pointerType === 'touch' && point && state.activeTool !== 'brush') {
    const moved = Math.hypot(point.x - point.startX, point.y - point.startY);
    if (moved < 12) {
      const now = performance.now();
      if (lastTap && now - lastTap.time < 320 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 24) {
        fitToView();
        status('Artwork fit to view.');
        lastTap = null;
      } else {
        lastTap = {time: now, x: point.x, y: point.y};
      }
    }
  }
}
viewer.addEventListener('pointerup', finishPointer);
viewer.addEventListener('pointercancel', finishPointer);

window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target.closest?.('input, textarea, select, button')) return;
  if (!state.img) return;
  event.preventDefault();
  state.spaceDown = true;
  updateViewerCursor();
});
window.addEventListener('keyup', event => {
  if (event.code !== 'Space') return;
  state.spaceDown = false;
  updateViewerCursor();
});
window.addEventListener('blur', () => { state.spaceDown = false; updateViewerCursor(); });

new ResizeObserver(() => {
  if (!state.img) return;
  if (state.zoomMode === 'fit') fitToView();
  else applyViewTransform();
}).observe(viewer);

function applyThreshold(cutoff) {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114;
    const value = lum > cutoff ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = value;
  }
  ctx.putImageData(data, 0, 0);
}

function applyDither(method, size, intensity) {
  const w = canvas.width, h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const s = Math.max(1, size | 0);
  const bw = Math.ceil(w / s), bh = Math.ceil(h / s);
  const lum = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let sum = 0, n = 0;
    const x0 = bx * s, y0 = by * s, x1 = Math.min(x0 + s, w), y1 = Math.min(y0 + s, h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4, a = d[i + 3] / 255;
      sum += (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) * a + 255 * (1 - a);
      n++;
    }
    lum[by * bw + bx] = n ? sum / n : 255;
  }
  const bias = (50 - intensity) * 1.4;
  for (let i = 0; i < lum.length; i++) lum[i] = Math.max(0, Math.min(255, lum[i] + bias));

  const out = new Float32Array(bw * bh);
  if (method === 'floyd-steinberg' || method === 'jarvis') {
    const K = method === 'jarvis'
      ? [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]]
      : [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];
    const denom = method === 'jarvis' ? 48 : 16;
    const buf = Float32Array.from(lum);
    for (let y = 0; y < bh; y++) {
      const ltr = y % 2 === 0;
      for (let k = 0; k < bw; k++) {
        const x = ltr ? k : bw - 1 - k, i = y * bw + x;
        const old = buf[i], nv = old >= 128 ? 255 : 0;
        out[i] = nv;
        const err = old - nv;
        for (const [dx, dy, wt] of K) {
          const nx = ltr ? x + dx : x - dx, ny = y + dy;
          if (nx >= 0 && nx < bw && ny < bh) buf[ny * bw + nx] += err * wt / denom;
        }
      }
    }
  } else if (method === 'bayer') {
    const M = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const t = (M[(y & 7) * 8 + (x & 7)] + .5) / 64 * 255;
      out[y * bw + x] = lum[y * bw + x] > t ? 255 : 0;
    }
  } else if (method === 'round-dot') {
    for (let i = 0; i < lum.length; i++) out[i] = lum[i];
  }

  const dst = ctx.createImageData(w, h);
  const dd = dst.data;
  for (let i = 0; i < dd.length; i += 4) { dd[i] = dd[i + 1] = dd[i + 2] = 255; dd[i + 3] = 255; }
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const i = by * bw + bx;
    if (method === 'round-dot') {
      const ink = 1 - out[i] / 255;
      if (ink <= 0) continue;
      const r = Math.sqrt(ink) * s * .55;
      const cx = bx * s + s / 2, cy = by * s + s / 2, r2 = r * r;
      for (let y = Math.max(0, cy - r | 0); y < Math.min(h, cy + r); y++)
        for (let x = Math.max(0, cx - r | 0); x < Math.min(w, cx + r); x++)
          if ((x - cx + .5) ** 2 + (y - cy + .5) ** 2 <= r2) { const p = (y * w + x) * 4; dd[p] = dd[p + 1] = dd[p + 2] = 0; }
    } else if (out[i] === 0) {
      for (let y = by * s; y < Math.min(by * s + s, h); y++)
        for (let x = bx * s; x < Math.min(bx * s + s, w); x++) {
          const p = (y * w + x) * 4; dd[p] = dd[p + 1] = dd[p + 2] = 0;
        }
    }
  }
  ctx.putImageData(dst, 0, 0);
}

function scheduleRender() {
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => { state.raf = 0; render(); });
}

function syncControls() {
  const dithering = state.method !== 'none';
  $('brightness').disabled = $('contrast').disabled = !state.img;
  $('method').disabled = !state.img;
  $('dotsize').disabled = $('intensity').disabled = !state.img || !dithering;
  $('threshold').disabled = !state.img || dithering;
  for (const id of ['brightness', 'contrast', 'threshold', 'dotsize', 'intensity']) $(id).value = state[id];
  $('threshold-value').textContent = dithering ? '—' : (state.threshold ? String(state.threshold) : 'off');
  $('brightness-value').textContent = String(state.brightness);
  $('contrast-value').textContent = String(state.contrast);
  $('dotsize-value').textContent = String(state.dotsize);
  $('intensity-value').textContent = String(state.intensity);
  $('mirror').disabled = $('reset').disabled = $('compare').disabled = $('export').disabled = !state.img;
  $('brush-tool').disabled = $('hand-tool').disabled = !state.img;
  syncZoomControls();
  updateViewerCursor();
  updateHistory();
}

for (const id of ['brightness', 'contrast', 'threshold', 'dotsize', 'intensity']) {
  $(id).addEventListener('input', () => {
    if (!state.gesture) { pushHistory(); state.gesture = true; }
    state[id] = Number($(id).value);
    syncControls(); scheduleRender();
  });
  $(id).addEventListener('change', () => { state.gesture = false; });
}
$('method').addEventListener('change', () => {
  pushHistory();
  state.method = $('method').value;
  syncControls(); scheduleRender();
});
$('mirror').onclick = () => { pushHistory(); state.mirrored = !state.mirrored; syncControls(); render(); status(state.mirrored ? 'Mirrored for transfer.' : 'Mirror off.'); };
$('reset').onclick = () => { pushHistory(); Object.assign(state, DEFAULTS); syncControls(); render(); status('Settings reset.'); };
$('undo').onclick = undo;
$('redo').onclick = redo;
window.addEventListener('keydown', event => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
  event.preventDefault();
  event.shiftKey ? redo() : undo();
});
$('compare').addEventListener('pointerdown', () => {
  if (!state.img) return;
  state.comparing = true;
  render(true);
}, {passive: true});
window.addEventListener('pointerup', () => {
  if (!state.comparing) return;
  state.comparing = false;
  render();
}, {passive: true});
window.addEventListener('pointercancel', () => {
  if (!state.comparing) return;
  state.comparing = false;
  render();
}, {passive: true});
$('export').onclick = () => {
  render();
  canvas.toBlob(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = state.name.replace(/\.[^.]+$/, '') + '-stencil.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    status('PNG exported.');
  });
};
