'use strict';
const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const viewer = $('viewer');
const stage = $('canvas-stage');
const zoomLabel = $('zoom-label');
const brushRing = $('brush-ring');
const rollGuide = $('roll-guide');
const selectionBox = $('selection-box');
const baseCanvas = document.createElement('canvas');
const baseCtx = baseCanvas.getContext('2d', {willReadFrequently: true});
const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', {willReadFrequently: true});
const ghostCanvas = document.createElement('canvas');
const ghostCtx = ghostCanvas.getContext('2d', {willReadFrequently: true});
const MIN_ZOOM = .25, MAX_ZOOM = 8;
const UNIT_MM = {mm: 1, cm: 10, inch: 25.4};
const DEFAULTS = {brightness: 0, contrast: 0, threshold: 0, method: 'none', dotsize: 4, intensity: 50, mirrored: false, despeckle: false, brushMode: 'break', brushSize: 12, brushStrength: 50, ghost: true, invert: false, randomSeed: null};
// Each preset tunes only the existing tonal and dithering controls. Mirror is
// intentionally excluded: transfer orientation always remains the user's choice.
const PRESETS = {
  clean: {label: 'clean stencil', brightness: 0, contrast: 0, method: 'none', despeckle: true, threshold: 'otsu'},
  newsprint: {label: 'newsprint', brightness: 8, contrast: 5, method: 'round-dot', dotsize: 5, intensity: 55},
  halftone: {label: 'halftone', brightness: 12, contrast: 0, method: 'round-dot', dotsize: 8, intensity: 50},
  xerox: {label: 'xerox', brightness: 8, contrast: 60, method: 'bayer', dotsize: 3, intensity: 70},
  riso: {label: 'riso', brightness: -4, contrast: 25, method: 'jarvis', dotsize: 2, intensity: 65},
  decay: {label: 'decay', brightness: -8, contrast: 35, method: 'floyd-steinberg', dotsize: 3, intensity: 80}
};
const state = {...DEFAULTS, img: null, name: '', history: [], future: [], gesture: false, comparing: false, raf: 0, zoom: 1, panX: 0, panY: 0, zoomMode: 'fit', activeTool: 'brush', spaceDown: false, renderMs: 0, renderMode: 'rgb', strokes: [], currentStroke: null, strokeBefore: null, strokePointerId: null, printWidth: 100, printHeight: 75, printUnit: 'mm', dpiPreset: '203', customDpi: 300, rotate90: false, sourceHash: null, selection: null, selectSession: null};
let importSequence = 0;
let pendingEvidence = null;
let baseMask = null;
let mask = null;
let ghostMask = null;
let baseDirty = true;
let maskDirty = true;

function cloneStrokes(strokes) {
  return strokes.map(operation => {
    if (operation.type === 'isolate') {
      return {type: 'isolate', rect: {...operation.rect}, seed: operation.seed};
    }
    if (operation.type === 'erase') {
      return {type: 'erase', rect: {...operation.rect}};
    }
    return {
      mode: operation.mode,
      radius: operation.radius,
      strength: operation.strength,
      seed: operation.seed,
      segments: operation.segments.map(segment => ({x: segment.x, y: segment.y}))
    };
  });
}

function invalidateBase() {
  baseDirty = true;
  maskDirty = true;
}

function status(message) { $('status').textContent = message; }
function snapshot() {
  const {brightness, contrast, threshold, method, dotsize, intensity, mirrored, invert, despeckle, randomSeed} = state;
  return {brightness, contrast, threshold, method, dotsize, intensity, mirrored, invert, despeckle, randomSeed, strokes: cloneStrokes(state.strokes)};
}
function cloneSnapshot(value) {
  return {...value, strokes: cloneStrokes(value.strokes || [])};
}
function pushHistory(previous = snapshot()) {
  state.history.push(cloneSnapshot(previous));
  if (state.history.length > 50) state.history.shift();
  state.future = [];
  updateHistory();
}
function updateHistory() {
  $('undo').disabled = !state.img || !state.history.length;
  $('redo').disabled = !state.img || !state.future.length;
}
function undo() {
  if (!state.history.length) return;
  state.future.push(snapshot());
  apply(state.history.pop());
}
function redo() {
  if (!state.future.length) return;
  state.history.push(snapshot());
  apply(state.future.pop());
}
function apply(s) {
  state.currentStroke = null;
  state.strokeBefore = null;
  state.strokePointerId = null;
  state.strokes = cloneStrokes(s.strokes || []);
  Object.assign(state, s);
  invalidateBase();
  syncControls();
  render();
  status('Change applied.');
}

const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = url;
  });
}

async function sha256Hex(buffer) {
  if (!crypto.subtle) throw new Error('Web Crypto is unavailable');
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function importImage(file, source = 'input') {
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
  const request = ++importSequence;
  const url = URL.createObjectURL(file);
  try {
    status('Reading image…');
    const [img, buffer] = await Promise.all([loadImage(url), file.arrayBuffer()]);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image');
    const sourceHash = await sha256Hex(buffer);
    if (request !== importSequence) return;
    Object.assign(state, DEFAULTS, {
      img,
      name: file.name,
      sourceHash,
      history: [],
      future: [],
      gesture: false,
      comparing: false,
      strokes: [],
      currentStroke: null,
      strokeBefore: null,
      strokePointerId: null,
      selection: null,
      selectSession: null
    });
    invalidateBase();
    canvas.style.display = 'block';
    $('empty').hidden = true;
    $('preview-label').textContent = file.name;
    syncControls();
    render();
    fitToView();
    status('Image ready. Adjust, then export for stencil transfer.');
  } catch (error) {
    if (request === importSequence) status('Could not read this image. Nothing changed.');
  } finally {
    URL.revokeObjectURL(url);
  }
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

function render(original = false, forExport = false) {
  if (!state.img) return;
  const t0 = performance.now();
  const {img} = state;
  if (canvas.width !== img.width || canvas.height !== img.height) {
    canvas.width = img.width;
    canvas.height = img.height;
    invalidateBase();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (original) {
    ctx.drawImage(img, 0, 0);
    state.renderMs = Math.round(performance.now() - t0);
    state.renderMode = 'source';
    updateImageInfo();
    return;
  }

  ensureStencilData();
  const stencilMode = state.method !== 'none' || state.threshold > 0 || state.despeckle || state.strokes.length > 0 || Boolean(state.currentStroke);
  if (stencilMode) paintMaskPreview(forExport);
  else paintTonePreview();

  state.renderMs = Math.round(performance.now() - t0);
  state.renderMode = stencilMode ? '1-bit' : 'rgb';
  updateImageInfo();
}

function ensureStencilData() {
  if (baseDirty) {
    buildBaseData();
    baseDirty = false;
    maskDirty = true;
  }
  if (maskDirty || !mask) rebuildAppliedMask();
}

function buildBaseData() {
  const {img} = state;
  baseCanvas.width = img.width;
  baseCanvas.height = img.height;
  baseCtx.setTransform(1, 0, 0, 1, 0, 0);
  baseCtx.filter = `brightness(${1 + state.brightness / 100}) contrast(${1 + state.contrast / 100})`;
  baseCtx.fillStyle = '#fff';
  baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
  if (state.mirrored) {
    baseCtx.translate(baseCanvas.width, 0);
    baseCtx.scale(-1, 1);
  }
  baseCtx.drawImage(img, 0, 0);
  baseCtx.setTransform(1, 0, 0, 1, 0, 0);
  baseCtx.filter = 'none';

  if (state.method !== 'none') applyDither(baseCtx, state.method, state.dotsize, state.intensity);
  else if (state.threshold > 0) applyThreshold(baseCtx, state.threshold * 2.55);

  const pixels = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height).data;
  baseMask = new Uint8Array(baseCanvas.width * baseCanvas.height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const lum = pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114;
    baseMask[p] = lum < 128 ? 1 : 0;
  }
}

function operationBounds(rect, width, height) {
  const x0 = clamp(Math.round(rect.x), 0, width);
  const y0 = clamp(Math.round(rect.y), 0, height);
  const x1 = clamp(Math.round(rect.x + rect.width), x0, width);
  const y1 = clamp(Math.round(rect.y + rect.height), y0, height);
  return {x0, y0, x1, y1};
}

function applyTreatmentToMask(operation) {
  const width = baseCanvas.width;
  const {x0, y0, x1, y1} = operationBounds(operation.rect, width, baseCanvas.height);
  for (let y = 0; y < baseCanvas.height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      if (operation.type === 'isolate' ? !inside : inside) {
        mask[y * width + x] = 0;
        ghostMask[y * width + x] = 0;
      }
    }
  }
}

function rebuildAppliedMask() {
  if (!baseMask|| !baseCanvas.width || !baseCanvas.height) return;
  mask = baseMask.slice();
  ghostMask = new Uint8Array(mask.length);
  ghostMask.fill(1);
  for (const operation of state.strokes) {
    if (operation.type === 'isolate' || operation.type === 'erase') applyTreatmentToMask(operation);
    else applyStrokeToMask(operation);
  }
  if (state.despeckle) removeSmallComponents(mask, baseCanvas.width, baseCanvas.height, 4);
  maskDirty = false;
}

function paintTonePreview() {
  ctx.filter = state.invert ? 'invert(1)' : 'none';
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.filter = 'none';
}

function paintMaskPreview(forExport = false) {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = state.invert ? '#000' : '#fff';
  ctx.fillRect(0, 0, w, h);
  if (state.ghost && !forExport) {
    if (ghostCanvas.width !== w || ghostCanvas.height !== h) {
      ghostCanvas.width = w;
      ghostCanvas.height = h;
    }
    ghostCtx.setTransform(1, 0, 0, 1, 0, 0);
    ghostCtx.clearRect(0, 0, w, h);
    if (state.mirrored) {
      ghostCtx.translate(w, 0);
      ghostCtx.scale(-1, 1);
    }
    ghostCtx.drawImage(state.img, 0, 0);
    ghostCtx.setTransform(1, 0, 0, 1, 0, 0);
    if (ghostMask) {
      const ghostPixels = ghostCtx.getImageData(0, 0, w, h);
      for (let p = 0; p < ghostMask.length; p++) {
        if (!ghostMask[p]) ghostPixels.data[p * 4 + 3] = 0;
      }
      ghostCtx.putImageData(ghostPixels, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = .25;
    ctx.drawImage(ghostCanvas, 0, 0);
    ctx.restore();
  }
  if (maskCanvas.width !== w || maskCanvas.height !== h) {
    maskCanvas.width = w;
    maskCanvas.height = h;
  }
  const overlay = maskCtx.createImageData(w, h);
  const data = overlay.data;
  const ink = state.invert ? 255 : 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * 4;
    data[i] = data[i + 1] = data[i + 2] = ink;
    data[i + 3] = 255;
  }
  maskCtx.putImageData(overlay, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function updateImageInfo() {
  if (!state.img) {
    $('image-info').textContent = '—';
    return;
  }
  $('image-info').textContent = `${state.img.width} × ${state.img.height} · ${state.renderMode} · ${state.renderMs} ms · ${Math.round(state.zoom * 100)}%`;
}

function printDpi() {
  const custom = Number(state.customDpi);
  if (state.dpiPreset === 'custom') return Number.isFinite(custom) ? clamp(Math.round(custom), 36, 2400) : 203;
  return Number(state.dpiPreset) || 203;
}

function printPixels() {
  const dpi = printDpi();
  const widthMm = state.printWidth * UNIT_MM[state.printUnit];
  const heightMm = state.printHeight * UNIT_MM[state.printUnit];
  return {
    dpi,
    width: Math.max(1, Math.round(widthMm * dpi / 25.4)),
    height: Math.max(1, Math.round(heightMm * dpi / 25.4))
  };
}

function syncPrintControls() {
  const disabled = !state.img;
  $('print-width').disabled = $('print-height').disabled = $('print-unit').disabled = $('dpi-select').disabled = disabled;
  $('custom-dpi').disabled = disabled || state.dpiPreset !== 'custom';
  $('custom-dpi-label').hidden = state.dpiPreset !== 'custom';
  $('invert-toggle').disabled = $('rotate-90').disabled = disabled;
  $('print-width').value = String(state.printWidth);
  $('print-height').value = String(state.printHeight);
  $('print-unit').value = state.printUnit;
  $('dpi-select').value = state.dpiPreset;
  $('custom-dpi').value = String(state.customDpi);
  $('invert-toggle').checked = state.invert;
  $('rotate-90').setAttribute('aria-pressed', String(state.rotate90));
  const widthCm = state.printWidth * UNIT_MM[state.printUnit] / 10;
  const heightCm = state.printHeight * UNIT_MM[state.printUnit] / 10;
  $('print-summary').textContent = `prints at ${widthCm.toFixed(1)} × ${heightCm.toFixed(1)} cm @ ${printDpi()} dpi`;
  updateRollGuide();
}

function updateRollGuide() {
  if (!state.img || !canvas.width) {
    rollGuide.hidden = true;
    return;
  }
  const {dpi, width} = printPixels();
  const guideX = (58 * dpi / 25.4) * (canvas.width / width);
  const visible = guideX > 0 && guideX < canvas.width;
  rollGuide.hidden = !visible;
  if (!visible) return;
  rollGuide.style.left = `${guideX}px`;
  rollGuide.style.setProperty('--inverse-zoom', String(1 / state.zoom));
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
  updateSelectionOverlay();
  updateRollGuide();
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
  if (state.activeTool === 'select' && tool !== 'select') clearSelection(false);
  state.activeTool = tool;
  $('brush-tool').setAttribute('aria-pressed', String(tool === 'brush'));
  $('hand-tool').setAttribute('aria-pressed', String(tool === 'hand'));
  $('select-tool').setAttribute('aria-pressed', String(tool === 'select'));
  updateViewerCursor();
  updateBrushRing({clientX: -1, clientY: -1});
  status(tool === 'hand' ? 'Hand tool active. Drag to pan.' : tool === 'select' ? 'Select tool active. Drag a rectangle.' : 'Brush tool active.');
}

function updateViewerCursor() {
  viewer.classList.toggle('is-pan-ready', Boolean(state.img) && (state.activeTool === 'hand' || state.spaceDown));
  viewer.classList.toggle('is-selecting', Boolean(state.img) && state.activeTool === 'select');
}

function selectionStatus(rect = state.selection) {
  if (!rect) return;
  status(`selection ${Math.round(rect.width)} × ${Math.round(rect.height)}`);
}

function updateSelectionOverlay() {
  const rect = state.selection;
  const available = Boolean(state.img && rect && rect.width > 0 && rect.height > 0);
  selectionBox.hidden = !available;
  $('selection-actions').hidden = !Boolean(state.img && rect);
  for (const id of ['isolate', 'erase-inside', 'crop']) $(id).disabled = !available || state.cropping;
  if (!available) return;
  const canvasRect = canvas.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  selectionBox.style.left = `${canvasRect.left - viewerRect.left + rect.x * scaleX}px`;
  selectionBox.style.top = `${canvasRect.top - viewerRect.top + rect.y * scaleY}px`;
  selectionBox.style.width = `${Math.max(1, rect.width * scaleX)}px`;
  selectionBox.style.height = `${Math.max(1, rect.height * scaleY)}px`;
}

function clearSelection(announce = true) {
  state.selectSession = null;
  state.selection = null;
  updateSelectionOverlay();
  if (announce && state.img) status('Selection cleared.');
}

function normalizedSelection(start, end) {
  const x = Math.max(0, Math.min(start.x, end.x));
  const y = Math.max(0, Math.min(start.y, end.y));
  const right = Math.min(canvas.width, Math.max(start.x, end.x));
  const bottom = Math.min(canvas.height, Math.max(start.y, end.y));
  return {x, y, width: right - x, height: bottom - y};
}

function selectionPixelRect() {
  if (!state.selection) return null;
  const bounds = operationBounds(state.selection, canvas.width, canvas.height);
  return {x: bounds.x0, y: bounds.y0, width: bounds.x1 - bounds.x0, height: bounds.y1 - bounds.y0};
}

function beginSelection(event) {
  const point = canvasPoint(event);
  if (!point) return false;
  state.selectSession = {
    pointerId: event.pointerId,
    start: point,
    previous: state.selection ? {...state.selection} : null,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
  viewer.classList.add('is-selecting-rect');
  return true;
}

function updateSelectionDrag(event) {
  const session = state.selectSession;
  if (!session || session.pointerId !== event.pointerId) return;
  if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 2) return;
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: clamp((event.clientX - rect.left) / rect.width * canvas.width, 0, canvas.width),
    y: clamp((event.clientY - rect.top) / rect.height * canvas.height, 0, canvas.height)
  };
  session.moved = true;
  state.selection = normalizedSelection(session.start, point);
  updateSelectionOverlay();
  selectionStatus(state.selection);
}

function finishSelection(event) {
  const session = state.selectSession;
  if (!session || session.pointerId !== event.pointerId) return;
  state.selectSession = null;
  viewer.classList.remove('is-selecting-rect');
  if (event.type !== 'pointerup') {
    state.selection = session.previous;
    updateSelectionOverlay();
    return;
  }
  if (!session.moved) {
    if (session.previous && !pointInSelection(session.start, session.previous)) clearSelection();
    else {
      state.selection = session.previous;
      updateSelectionOverlay();
      if (state.selection) selectionStatus();
    }
    return;
  }
  const bounds = operationBounds(state.selection, canvas.width, canvas.height);
  const rect = {x: bounds.x0, y: bounds.y0, width: bounds.x1 - bounds.x0, height: bounds.y1 - bounds.y0};
  if (!rect.width || !rect.height) {
    state.selection = session.previous;
    updateSelectionOverlay();
    return;
  }
  state.selection = rect;
  updateSelectionOverlay();
  selectionStatus(rect);
}

function pointInSelection(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function cancelSelectionDrag() {
  if (!state.selectSession) return;
  state.selection = state.selectSession.previous;
  state.selectSession = null;
  viewer.classList.remove('is-selecting-rect');
  updateSelectionOverlay();
}

function applySelectionTreatment(type) {
  if (!state.img || !state.selection || state.cropping) return;
  const rect = selectionPixelRect();
  if (!rect || !rect.width || !rect.height) return;
  pushHistory();
  const operation = type === 'isolate'
    ? {type: 'isolate', rect, seed: seedHex()}
    : {type: 'erase', rect};
  state.strokes.push(operation);
  maskDirty = true;
  render();
  status(`${type === 'isolate' ? 'Isolated' : 'Erased inside'} ${rect.width} × ${rect.height}.`);
}

async function cropSelection() {
  if (!state.img || !state.selection || state.cropping) return;
  const rect = selectionPixelRect();
  if (!rect || !rect.width || !rect.height) return;
  state.cropping = true;
  updateSelectionOverlay();
  try {
    render(false, true);
    const cropped = document.createElement('canvas');
    cropped.width = rect.width;
    cropped.height = rect.height;
    cropped.getContext('2d').drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    let croppedHash = state.sourceHash;
    const blob = await new Promise(resolve => cropped.toBlob(resolve, 'image/png'));
    if (blob) croppedHash = await sha256Hex(await blob.arrayBuffer());
    const name = state.name;
    Object.assign(state, DEFAULTS, {
      img: cropped,
      name,
      sourceHash: croppedHash,
      history: [],
      future: [],
      gesture: false,
      comparing: false,
      strokes: [],
      currentStroke: null,
      strokeBefore: null,
      strokePointerId: null,
      selection: null,
      selectSession: null
    });
    invalidateBase();
    syncControls();
    render();
    fitToView();
    updateHistory();
    updateSelectionOverlay();
    status(`Cropped to ${cropped.width} × ${cropped.height}.`);
  } catch (error) {
    render();
    status('Crop failed. Nothing changed.');
  } finally {
    state.cropping = false;
    updateSelectionOverlay();
  }
}

$('zoom-out').onclick = () => setZoom(state.zoom / 1.25);
$('zoom-in').onclick = () => setZoom(state.zoom * 1.25);
$('zoom-fit').onclick = () => { fitToView(); status('Artwork fit to view.'); };
$('brush-tool').onclick = () => selectTool('brush');
$('hand-tool').onclick = () => selectTool('hand');
$('select-tool').onclick = () => selectTool('select');
$('isolate').onclick = () => applySelectionTreatment('isolate');
$('erase-inside').onclick = () => applySelectionTreatment('erase');
$('crop').onclick = cropSelection;

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
  if (state.currentStroke) finishBrushStroke(false);
  cancelSelectionDrag();
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
  try { viewer.setPointerCapture?.(event.pointerId); } catch {}
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY});
  if (pointers.size === 2) beginPinch();
  else if (state.activeTool === 'hand' || state.spaceDown || event.button === 1) beginPan(event.pointerId, event.clientX, event.clientY);
  else if (state.activeTool === 'brush' && event.button === 0) beginBrushStroke(event);
  else if (state.activeTool === 'select' && event.button === 0) {
    if (canvasPoint(event)) beginSelection(event);
    else if (state.selection) clearSelection();
  }
});

viewer.addEventListener('pointermove', event => {
  updateBrushRing(event);
  updateSelectionDrag(event);
  const point = pointers.get(event.pointerId);
  if (!point) return;
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
  } else if (state.currentStroke && state.strokePointerId === event.pointerId) {
    appendBrushPoint(event);
  }
});

function finishPointer(event) {
  if (state.selectSession && state.selectSession.pointerId === event.pointerId) finishSelection(event);
  if (state.currentStroke && state.strokePointerId === event.pointerId) finishBrushStroke(event.type === 'pointerup');
  const point = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (panSession?.pointerId === event.pointerId) panSession = null;
  if (pointers.size < 2) pinchSession = null;
  if (!pointers.size) viewer.classList.remove('is-panning');
  if (event.pointerType === 'touch' && point) {
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
viewer.addEventListener('pointerleave', () => { brushRing.hidden = true; });

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

function removeSmallComponents(target, width, height, minSize) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let removed = 0;
  for (let start = 0; start < target.length; start++) {
    if (!target[start] || visited[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width, y = (index / width) | 0;
      if (x > 0) {
        const next = index - 1;
        if (target[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (x + 1 < width) {
        const next = index + 1;
        if (target[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y > 0) {
        const next = index - width;
        if (target[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y + 1 < height) {
        const next = index + width;
        if (target[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail < minSize) {
      for (let i = 0; i < tail; i++) target[queue[i]] = 0;
      removed += tail;
    }
  }
  return removed;
}

function otsuThreshold() {
  const analysis = document.createElement('canvas');
  analysis.width = state.img.width;
  analysis.height = state.img.height;
  const target = analysis.getContext('2d', {willReadFrequently: true});
  target.filter = `brightness(${1 + state.brightness / 100}) contrast(${1 + state.contrast / 100})`;
  target.fillStyle = '#fff';
  target.fillRect(0, 0, analysis.width, analysis.height);
  target.drawImage(state.img, 0, 0);
  target.filter = 'none';
  const pixels = target.getImageData(0, 0, analysis.width, analysis.height).data;
  const histogram = new Uint32Array(256);
  let totalSum = 0;
  const total = analysis.width * analysis.height;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114);
    histogram[lum]++;
    totalSum += lum;
  }
  let backgroundWeight = 0, backgroundSum = 0, bestVariance = -1, cutoff = 127;
  for (let level = 0; level < 256; level++) {
    backgroundWeight += histogram[level];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += level * histogram[level];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      cutoff = level;
    }
  }
  return cutoff;
}

function applyThreshold(target, cutoff) {
  const data = target.getImageData(0, 0, target.canvas.width, target.canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114;
    const value = lum > cutoff ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = value;
  }
  target.putImageData(data, 0, 0);
}

function applyDither(target, method, size, intensity) {
  const w = target.canvas.width, h = target.canvas.height;
  const src = target.getImageData(0, 0, w, h);
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

  const dst = target.createImageData(w, h);
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
  target.putImageData(dst, 0, 0);
}

function seedHex() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hashUnit(seed, segmentIndex, x, y, salt = 0) {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= segmentIndex + 0x9e3779b9;
  hash = Math.imul(hash, 16777619);
  hash ^= x + 0x85ebca6b;
  hash = Math.imul(hash, 16777619);
  hash ^= y + 0xc2b2ae35;
  hash = Math.imul(hash, 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function stampSegment(stroke, segment, segmentIndex) {
  if (!mask) return;
  const w = canvas.width, h = canvas.height;
  const radius = Math.max(1, stroke.radius);
  const strength = clamp(stroke.strength / 100, 0, 1);
  if (!strength && stroke.mode !== 'restore') return;
  const x0 = Math.max(0, Math.floor(segment.x - radius - 1));
  const y0 = Math.max(0, Math.floor(segment.y - radius - 1));
  const x1 = Math.min(w, Math.ceil(segment.x + radius + 2));
  const y1 = Math.min(h, Math.ceil(segment.y + radius + 2));
  const rw = x1 - x0, rh = y1 - y0;
  const source = new Uint8Array(rw * rh);
  for (let y = y0; y < y1; y++) {
    const row = (y - y0) * rw;
    const imageRow = y * w;
    for (let x = x0; x < x1; x++) source[row + x - x0] = mask[imageRow + x];
  }

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + .5 - segment.x, dy = y + .5 - segment.y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius + .75) continue;
      const local = (y - y0) * rw + x - x0;
      const index = y * w + x;
      const ink = source[local];
      const edge = clamp(distance / radius, 0, 1);

      if (stroke.mode === 'restore') {
        if (distance <= radius + .5) mask[index] = baseMask[index];
      } else if (stroke.mode === 'break') {
        if (ink) {
          const chance = strength * (.07 + .68 * Math.pow(edge, 1.55));
          if (hashUnit(stroke.seed, segmentIndex, x, y, 11) < chance) mask[index] = 0;
        } else if (distance > radius * .68 && hashUnit(stroke.seed, segmentIndex, x, y, 12) < strength * strength * .055) {
          mask[index] = 1;
        }
      } else if (stroke.mode === 'thin') {
        if (ink && hashUnit(stroke.seed, segmentIndex, x, y, 21) < strength * (.18 + .68 * edge)) mask[index] = 0;
      } else if (stroke.mode === 'fatten') {
        if (!ink && distance <= radius) {
          let touchesInk = false;
          for (let oy = -1; oy <= 1 && !touchesInk; oy++) {
            const ny = y + oy;
            if (ny < 0 || ny >= h) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const nx = x + ox;
              if (nx < 0 || nx >= w) continue;
              if (mask[ny * w + nx]) { touchesInk = true; break; }
            }
          }
          if (touchesInk && hashUnit(stroke.seed, segmentIndex, x, y, 31) < .3 + strength * .7) mask[index] = 1;
        }
      } else if (stroke.mode === 'dissolve') {
        if (!ink) continue;
        let onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (!onEdge) onEdge = !mask[index - 1] || !mask[index + 1] || !mask[index - w] || !mask[index + w];
        if (onEdge && hashUnit(stroke.seed, segmentIndex, x, y, 41) < strength * (.28 + .62 * edge)) mask[index] = 0;
      }
    }
  }
}

function applyStrokeToMask(stroke) {
  stroke.segments.forEach((segment, index) => stampSegment(stroke, segment, index));
}

function canvasPoint(event) {
  if (!state.img) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
  return {
    x: Math.round((event.clientX - rect.left) / rect.width * canvas.width * 100) / 100,
    y: Math.round((event.clientY - rect.top) / rect.height * canvas.height * 100) / 100
  };
}

function beginBrushStroke(event) {
  const point = canvasPoint(event);
  if (!point) return false;
  ensureStencilData();
  state.strokeBefore = snapshot();
  state.currentStroke = {mode: state.brushMode, radius: state.brushSize, strength: state.brushStrength, seed: seedHex(), segments: [{x: point.x, y: point.y}]};
  state.strokePointerId = event.pointerId;
  state.gesture = true;
  viewer.classList.add('is-drawing');
  stampSegment(state.currentStroke, state.currentStroke.segments[0], 0);
  scheduleRender();
  return true;
}

function appendBrushPoint(event) {
  if (!state.currentStroke || state.strokePointerId !== event.pointerId) return;
  const point = canvasPoint(event);
  if (!point) return;
  const segments = state.currentStroke.segments;
  const previous = segments[segments.length - 1];
  const spacing = Math.max(1, state.currentStroke.radius * .18);
  if (Math.hypot(point.x - previous.x, point.y - previous.y) < spacing) return;
  segments.push(point);
  stampSegment(state.currentStroke, point, segments.length - 1);
  scheduleRender();
}

function finishBrushStroke(commit) {
  if (!state.currentStroke) return;
  const stroke = state.currentStroke;
  const before = state.strokeBefore;
  state.currentStroke = null;
  state.strokePointerId = null;
  state.strokeBefore = null;
  state.gesture = false;
  viewer.classList.remove('is-drawing');
  if (commit && stroke.segments.length && before) {
    state.strokes.push(stroke);
    pushHistory(before);
    maskDirty = true;
    render();
    status(`${stroke.mode.charAt(0).toUpperCase() + stroke.mode.slice(1)} stroke applied.`);
  } else {
    maskDirty = true;
    render();
  }
}

function updateBrushRing(event) {
  const point = canvasPoint(event);
  if (!point || state.activeTool !== 'brush' || state.spaceDown || panSession || pinchSession) {
    brushRing.hidden = true;
    return;
  }
  const viewerRect = viewer.getBoundingClientRect();
  const diameter = Math.max(2, state.brushSize * 2 * state.zoom);
  brushRing.hidden = false;
  brushRing.style.width = `${diameter}px`;
  brushRing.style.height = `${diameter}px`;
  brushRing.style.left = `${event.clientX - viewerRect.left}px`;
  brushRing.style.top = `${event.clientY - viewerRect.top}px`;
}

function scheduleRender() {
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => { state.raf = 0; render(); });
}

const RANDOM_METHODS = ['none', 'floyd-steinberg', 'jarvis', 'bayer', 'round-dot'];

function hashField(seed, field, salt = 0) {
  let fieldHash = 2166136261;
  for (let i = 0; i < field.length; i++) {
    fieldHash ^= field.charCodeAt(i);
    fieldHash = Math.imul(fieldHash, 16777619);
  }
  return hashUnit(seed, fieldHash, 0, 0, salt + 2027);
}

function seededInteger(seed, field, min, max) {
  return min + Math.floor(hashField(seed, field) * (max - min + 1));
}

function randomizedSettings(seed) {
  return {
    method: RANDOM_METHODS[seededInteger(seed, 'method', 0, RANDOM_METHODS.length - 1)],
    dotsize: seededInteger(seed, 'dotsize', 2, 12),
    intensity: seededInteger(seed, 'intensity', 25, 85),
    brightness: seededInteger(seed, 'brightness', -30, 30),
    contrast: seededInteger(seed, 'contrast', 20, 80),
    threshold: seededInteger(seed, 'threshold', 20, 80)
  };
}

function randomize(seed = seedHex()) {
  if (!state.img) return;
  pushHistory();
  Object.assign(state, randomizedSettings(seed), {randomSeed: seed});
  invalidateBase();
  syncControls();
  render();
  status(`randomized · seed ${seed}`);
}

function applyPreset(id) {
  const preset = PRESETS[id];
  if (!state.img || !preset) return;
  pushHistory();
  const {label, threshold, ...settings} = preset;
  Object.assign(state, settings);
  if (threshold === 'otsu') state.threshold = clamp(Math.round(otsuThreshold() / 2.55), 1, 100);
  invalidateBase();
  syncControls();
  render();
  status(`preset: ${label}`);
}

function syncControls() {
  const dithering = state.method !== 'none';
  $('brightness').disabled = $('contrast').disabled = !state.img;
  $('method').disabled = !state.img;
  $('dotsize').disabled = $('intensity').disabled = !state.img || !dithering;
  $('threshold').disabled = !state.img || dithering;
  $('brush-mode').disabled = $('brush-size').disabled = $('brush-strength').disabled = $('ghost-toggle').disabled = !state.img;
  for (const button of document.querySelectorAll('[data-preset]')) button.disabled = !state.img;
  $('randomize').disabled = !state.img;
  for (const id of ['brightness', 'contrast', 'threshold', 'dotsize', 'intensity', 'brush-size', 'brush-strength']) $(id).value = state[id];
  $('method').value = state.method;
  $('brush-mode').value = state.brushMode;
  $('ghost-toggle').checked = state.ghost;
  $('threshold-value').textContent = dithering ? '—' : (state.threshold ? String(state.threshold) : 'off');
  $('brightness-value').textContent = String(state.brightness);
  $('contrast-value').textContent = String(state.contrast);
  $('dotsize-value').textContent = String(state.dotsize);
  $('intensity-value').textContent = String(state.intensity);
  $('brush-size-value').textContent = String(state.brushSize);
  $('brush-strength-value').textContent = String(state.brushStrength);
  $('mirror').disabled = $('reset').disabled = $('compare').disabled = $('export').disabled = $('auto-threshold').disabled = $('despeckle').disabled = !state.img;
  $('mirror').setAttribute('aria-pressed', String(state.mirrored));
  $('brush-tool').disabled = $('hand-tool').disabled = $('select-tool').disabled = !state.img;
  updateSelectionOverlay();
  syncZoomControls();
  syncPrintControls();
  updateViewerCursor();
  updateHistory();
}

for (const id of ['brightness', 'contrast', 'threshold', 'dotsize', 'intensity']) {
  $(id).addEventListener('input', () => {
    if (!state.gesture) { pushHistory(); state.gesture = true; }
    state[id] = Number($(id).value);
    invalidateBase();
    syncControls(); scheduleRender();
  });
  $(id).addEventListener('change', () => { state.gesture = false; });
}
$('method').addEventListener('change', () => {
  pushHistory();
  state.method = $('method').value;
  invalidateBase();
  syncControls(); scheduleRender();
});
$('mirror').onclick = () => { pushHistory(); state.mirrored = !state.mirrored; invalidateBase(); syncControls(); render(); status(state.mirrored ? 'Mirrored for transfer.' : 'Mirror off.'); };
$('brush-mode').addEventListener('change', () => {
  state.brushMode = $('brush-mode').value;
  status(`${state.brushMode.charAt(0).toUpperCase() + state.brushMode.slice(1)} brush selected.`);
});
for (const id of ['brush-size', 'brush-strength']) {
  $(id).addEventListener('input', () => {
    state[id === 'brush-size' ? 'brushSize' : 'brushStrength'] = Number($(id).value);
    syncControls();
  });
}
$('ghost-toggle').addEventListener('change', () => {
  state.ghost = $('ghost-toggle').checked;
  render();
});
$('print-width').addEventListener('input', () => {
  state.printWidth = Math.max(.1, Number($('print-width').value) || .1);
  syncPrintControls();
});
$('print-height').addEventListener('input', () => {
  state.printHeight = Math.max(.1, Number($('print-height').value) || .1);
  syncPrintControls();
});
$('print-unit').addEventListener('change', () => {
  const previous = state.printUnit;
  const next = $('print-unit').value;
  if (!UNIT_MM[next]) return;
  const millimetres = state.printWidth * UNIT_MM[previous];
  const millimetresHeight = state.printHeight * UNIT_MM[previous];
  state.printUnit = next;
  state.printWidth = Math.max(.1, Math.round(millimetres / UNIT_MM[next] * 100) / 100);
  state.printHeight = Math.max(.1, Math.round(millimetresHeight / UNIT_MM[next] * 100) / 100);
  syncPrintControls();
});
$('dpi-select').addEventListener('change', () => {
  state.dpiPreset = $('dpi-select').value;
  syncPrintControls();
});
$('custom-dpi').addEventListener('input', () => {
  state.customDpi = Number($('custom-dpi').value) || 300;
  syncPrintControls();
});
$('invert-toggle').addEventListener('change', () => {
  if (!state.img) return;
  pushHistory();
  state.invert = $('invert-toggle').checked;
  syncPrintControls();
  render();
  status(state.invert ? 'Export inverted: white ink on black.' : 'Export inversion off.');
});
$('rotate-90').addEventListener('click', () => {
  if (!state.img) return;
  state.rotate90 = !state.rotate90;
  syncPrintControls();
  status(state.rotate90 ? 'Export rotation on: 90°.' : 'Export rotation off.');
});
for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => applyPreset(button.dataset.preset));
}
$('randomize').addEventListener('click', () => randomize());
$('auto-threshold').onclick = () => {
  if (!state.img || state.currentStroke) return;
  const cutoff = otsuThreshold();
  pushHistory();
  state.method = 'none';
  state.threshold = clamp(Math.round(cutoff / 2.55), 1, 100);
  invalidateBase();
  syncControls();
  render();
  status(`Auto threshold set to ${state.threshold}.`);
};
$('despeckle').onclick = () => {
  if (!state.img || state.currentStroke) return;
  ensureStencilData();
  const candidate = mask.slice();
  const removed = removeSmallComponents(candidate, canvas.width, canvas.height, 4);
  if (!removed) {
    status('No ink components under 4 px found.');
    return;
  }
  pushHistory();
  state.despeckle = true;
  maskDirty = true;
  render();
  status(`Despeckled ${removed} isolated ink ${removed === 1 ? 'pixel' : 'pixels'}.`);
};
$('reset').onclick = () => {
  pushHistory();
  state.strokes = [];
  state.selection = null;
  state.selectSession = null;
  state.currentStroke = null;
  state.strokeBefore = null;
  state.strokePointerId = null;
  Object.assign(state, DEFAULTS);
  invalidateBase();
  syncControls();
  render();
  updateSelectionOverlay();
  status('Settings reset.');
};
document.addEventListener('pointerdown', event => {
  if (!state.selection || state.activeTool !== 'select') return;
  if (viewer.contains(event.target) || event.target.closest?.('.preview-options')) return;
  clearSelection();
});
$('download-evidence').onclick = () => {
  if (!pendingEvidence) return;
  downloadBlob(pendingEvidence.blob, pendingEvidence.name);
  status(`Preparing ${pendingEvidence.name}.`);
};
$('undo').onclick = undo;
$('redo').onclick = redo;
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.selection) {
    event.preventDefault();
    clearSelection();
    return;
  }
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
function downloadBlob(blob, filename, delay = 0) {
  setTimeout(() => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, delay);
}

function buildEvidence() {
  const pixels = printPixels();
  return {
    tool: 'thr4ce',
    version: 1,
    random_seed: state.randomSeed,
    source: {
      name: state.name,
      width: state.img.width,
      height: state.img.height,
      sha256: state.sourceHash
    },
    settings: {
      brightness: state.brightness,
      contrast: state.contrast,
      threshold: state.threshold,
      method: state.method,
      dotsize: state.dotsize,
      intensity: state.intensity,
      mirrored: state.mirrored,
      invert: state.invert,
      despeckle: state.despeckle,
      brush: {
        mode: state.brushMode,
        radius: state.brushSize,
        strength: state.brushStrength,
        ghost: state.ghost
      },
      print: {
        width: state.printWidth,
        height: state.printHeight,
        unit: state.printUnit,
        dpi: pixels.dpi,
        pixel_width: pixels.width,
        pixel_height: pixels.height,
        rotate90: state.rotate90
      }
    },
    strokes: cloneStrokes(state.strokes),
    exported_at: new Date().toISOString()
  };
}

function buildExportCanvas() {
  const {dpi, width, height} = printPixels();
  const rotated = state.rotate90;
  const output = document.createElement('canvas');
  output.width = rotated ? height : width;
  output.height = rotated ? width : height;
  const target = output.getContext('2d');
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = 'high';
  target.fillStyle = state.invert ? '#000' : '#fff';
  target.fillRect(0, 0, output.width, output.height);
  const scale = Math.min(width / canvas.width, height / canvas.height);
  const drawWidth = canvas.width * scale;
  const drawHeight = canvas.height * scale;
  target.save();
  if (rotated) {
    target.translate(output.width / 2, output.height / 2);
    target.rotate(Math.PI / 2);
    target.drawImage(canvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  } else {
    target.drawImage(canvas, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  target.restore();
  output.dataset.dpi = String(dpi);
  return output;
}

$('export').onclick = () => {
  if (!state.img) return;
  if (state.currentStroke) finishBrushStroke(true);
  render(false, true);
  const output = buildExportCanvas();
  const dpi = Number(output.dataset.dpi);
  render();
  const baseName = state.name.replace(/\.[^.]+$/, '');
  const evidence = buildEvidence();
  output.toBlob(blob => {
    if (!blob) {
      status('Export failed.');
      return;
    }
    downloadBlob(blob, `${baseName}-stencil.png`);
    const evidenceBlob = new Blob([JSON.stringify(evidence, null, 2)], {type: 'application/json'});
    pendingEvidence = {blob: evidenceBlob, name: `${baseName}.stencil.json`};
    $('download-evidence').hidden = false;
    $('download-evidence').disabled = false;
    downloadBlob(evidenceBlob, pendingEvidence.name, 1200);
    status(`exported ${output.width} × ${output.height} @ ${dpi} dpi`);
  }, 'image/png');
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch (error) {
      // Registration is unavailable on file:// and in restricted contexts.
    }
  });
}
