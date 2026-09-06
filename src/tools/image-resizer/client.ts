import { $, debounce, downloadBlob, formatBytes, onFileDrop, setStatus } from '@/lib/dom';

import {
  type CropRect,
  type Dimensions,
  ImageError,
  type OutputFormat,
  type ResizeMode,
  assertUsableFile,
  describeCrop,
  describeSizes,
  formatDimensions,
  matchAspect,
  parseDimension,
  parseOffset,
  parsePercent,
  parseQuality,
  previewLayout,
  previewRect,
  qualityFor,
  resizedFileName,
  resolveCrop,
  resolveOutputType,
  resolveTarget,
} from './logic';

const IDLE_STATUS = 'Images are resized on your device and never leave your browser.';

interface Options {
  mode: ResizeMode;
  width: number;
  height: number;
  percent: number;
  preset: string;
  cropId: string;
  customCrop: CropRect | null;
  format: OutputFormat;
  quality: number;
}

interface Entry {
  id: number;
  file: File;
  row: HTMLLIElement;
  thumb: HTMLImageElement;
  meta: HTMLElement;
  button: HTMLButtonElement;
  url?: string | undefined;
  blob?: Blob | undefined;
  name?: string | undefined;
}

const root = $<HTMLElement>('[data-tool="image-resizer"]');
const fileInput = $<HTMLInputElement>('[data-file]', root);
const list = $<HTMLOListElement>('[data-results]', root);
const empty = $('[data-empty]', root);
const totals = $('[data-totals]', root);
const status = $('[data-status]', root);
const canvas = $<HTMLCanvasElement>('[data-canvas]', root);
const placeholder = $('[data-placeholder]', root);
const caption = $('[data-preview-caption]', root);

const modeSelect = $<HTMLSelectElement>('[data-opt="mode"]', root);
const widthInput = $<HTMLInputElement>('[data-opt="width"]', root);
const heightInput = $<HTMLInputElement>('[data-opt="height"]', root);
const lockInput = $<HTMLInputElement>('[data-opt="lock"]', root);
const percentInput = $<HTMLInputElement>('[data-opt="percent"]', root);
const presetSelect = $<HTMLSelectElement>('[data-opt="preset"]', root);
const cropSelect = $<HTMLSelectElement>('[data-opt="crop"]', root);
const cropX = $<HTMLInputElement>('[data-opt="crop-x"]', root);
const cropY = $<HTMLInputElement>('[data-opt="crop-y"]', root);
const cropWidth = $<HTMLInputElement>('[data-opt="crop-width"]', root);
const cropHeight = $<HTMLInputElement>('[data-opt="crop-height"]', root);
const cropInputs = [cropX, cropY, cropWidth, cropHeight];
const formatSelect = $<HTMLSelectElement>('[data-opt="format"]', root);
const qualityInput = $<HTMLInputElement>('[data-opt="quality"]', root);
const qualityValue = $('[data-quality]', root);
const downloadAll = $<HTMLButtonElement>('[data-action="download-all"]', root);
const clearButton = $<HTMLButtonElement>('[data-action="clear"]', root);

let entries: Entry[] = [];
let nextId = 0;
let runToken = 0;
/** The first image, kept decoded so the crop preview can redraw instantly. */
let preview: { name: string; bitmap: ImageBitmap } | null = null;

// --- options ---------------------------------------------------------------------

function readOptions(): Options {
  const mode = modeSelect.value as ResizeMode;
  const cropId = cropSelect.value;
  return {
    mode,
    width: mode === 'exact' ? parseDimension(widthInput.value, 'Width') : 0,
    height: mode === 'exact' ? parseDimension(heightInput.value, 'Height') : 0,
    percent: mode === 'percent' ? parsePercent(percentInput.value) : 100,
    preset: presetSelect.value,
    cropId,
    customCrop:
      cropId === 'custom'
        ? {
            x: parseOffset(cropX.value, 'Crop X'),
            y: parseOffset(cropY.value, 'Crop Y'),
            width: parseDimension(cropWidth.value, 'Crop width'),
            height: parseDimension(cropHeight.value, 'Crop height'),
          }
        : null,
    format: formatSelect.value as OutputFormat,
    quality: parseQuality(qualityInput.value),
  };
}

function message(err: unknown): string {
  if (err instanceof ImageError) return err.message;
  if (err instanceof Error) return `Could not resize the image: ${err.message}`;
  return 'Could not resize the image.';
}

function syncAvailability(): void {
  const mode = modeSelect.value;
  widthInput.disabled = mode !== 'exact';
  heightInput.disabled = mode !== 'exact';
  lockInput.disabled = mode !== 'exact';
  percentInput.disabled = mode !== 'percent';
  presetSelect.disabled = mode !== 'preset';
  const custom = cropSelect.value === 'custom';
  for (const el of cropInputs) el.disabled = !custom;
  qualityInput.disabled = formatSelect.value === 'image/png';
}

/** Keep the second edge in step with the first when the ratio is locked. */
function syncLocked(changed: 'width' | 'height'): void {
  if (!lockInput.checked || modeSelect.value !== 'exact') return;
  const base = previewCropSize();
  if (!base) return;
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  if (changed === 'width') {
    if (!Number.isFinite(width) || width < 1) return;
    heightInput.value = String(matchAspect(base, { width, height }, 'width').height);
  } else {
    if (!Number.isFinite(height) || height < 1) return;
    widthInput.value = String(matchAspect(base, { width, height }, 'height').width);
  }
}

/** The crop of the preview image, i.e. what the exact-size boxes describe. */
function previewCropSize(): Dimensions | null {
  if (!preview) return null;
  const source = { width: preview.bitmap.width, height: preview.bitmap.height };
  try {
    const crop = resolveCrop(source, cropSelect.value, currentCustomCrop());
    return { width: crop.width, height: crop.height };
  } catch {
    return null;
  }
}

function currentCustomCrop(): CropRect | null {
  if (cropSelect.value !== 'custom') return null;
  try {
    return {
      x: parseOffset(cropX.value, 'Crop X'),
      y: parseOffset(cropY.value, 'Crop Y'),
      width: parseDimension(cropWidth.value, 'Crop width'),
      height: parseDimension(cropHeight.value, 'Crop height'),
    };
  } catch {
    return null;
  }
}

/** Show the computed crop in the numeric boxes so a preset is never a mystery. */
function reflectCropBoxes(crop: CropRect): void {
  if (cropSelect.value === 'custom') return;
  cropX.value = String(crop.x);
  cropY.value = String(crop.y);
  cropWidth.value = String(crop.width);
  cropHeight.value = String(crop.height);
}

// --- preview ---------------------------------------------------------------------

function clearPreview(): void {
  preview?.bitmap.close();
  preview = null;
  canvas.hidden = true;
  placeholder.hidden = false;
  caption.textContent = '';
}

function drawPreview(): void {
  if (!preview) {
    canvas.hidden = true;
    placeholder.hidden = false;
    caption.textContent = '';
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const source = { width: preview.bitmap.width, height: preview.bitmap.height };
  const box = { width: canvas.width, height: canvas.height };

  let crop: CropRect;
  let target: Dimensions;
  try {
    crop = resolveCrop(source, cropSelect.value, currentCustomCrop());
    const options = readOptions();
    target = resolveTarget(options.mode, crop, {
      width: options.width,
      height: options.height,
      percent: options.percent,
      preset: options.preset,
    });
  } catch {
    crop = { x: 0, y: 0, width: source.width, height: source.height };
    target = crop;
  }
  reflectCropBoxes(crop);

  const layout = previewLayout(source, box);
  const rect = previewRect(crop, layout);

  ctx.clearRect(0, 0, box.width, box.height);
  ctx.drawImage(preview.bitmap, layout.offsetX, layout.offsetY, layout.width, layout.height);
  // Dim everything, then repaint the kept region at full strength.
  ctx.fillStyle = 'rgba(15, 18, 24, 0.6)';
  ctx.fillRect(0, 0, box.width, box.height);
  ctx.drawImage(
    preview.bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#0f1218';
  ctx.strokeRect(rect.x + 2.5, rect.y + 2.5, rect.width - 5, rect.height - 5);

  canvas.hidden = false;
  placeholder.hidden = true;
  caption.textContent =
    `${preview.name} · ${formatDimensions(source)} · ${describeCrop(crop, source)} · ` +
    `output ${formatDimensions(target)}`;
}

// --- rows ------------------------------------------------------------------------

function createRow(entry: Omit<Entry, 'row' | 'thumb' | 'meta' | 'button'>): Entry {
  const row = document.createElement('li');
  row.className = 'tool-image-resizer__row';

  const thumb = document.createElement('img');
  thumb.className = 'tool-image-resizer__thumb';
  thumb.width = 56;
  thumb.height = 56;
  thumb.alt = '';
  thumb.decoding = 'async';

  const info = document.createElement('div');
  info.className = 'tool-image-resizer__info';

  const name = document.createElement('p');
  name.className = 'tool-image-resizer__name';
  name.textContent = entry.file.name;

  const meta = document.createElement('p');
  meta.className = 'tool-image-resizer__meta';
  meta.dataset.rowMeta = '';
  meta.textContent = `${formatBytes(entry.file.size)} · queued`;

  info.append(name, meta);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm tool-image-resizer__download';
  button.dataset.action = 'download';
  button.dataset.id = String(entry.id);
  button.disabled = true;
  button.textContent = 'Download';
  button.setAttribute('aria-label', `Download ${entry.file.name}`);

  row.append(thumb, info, button);
  list.append(row);
  return { ...entry, row, thumb, meta, button };
}

function setUrl(entry: Entry, url: string | undefined): void {
  if (entry.url) URL.revokeObjectURL(entry.url);
  entry.url = url;
}

function updateChrome(): void {
  empty.hidden = entries.length > 0;
  downloadAll.disabled = !entries.some((e) => e.blob !== undefined);
  clearButton.disabled = entries.length === 0;
}

function updateTotals(): void {
  const done = entries.filter((e) => e.blob !== undefined);
  if (done.length === 0) {
    totals.textContent = '';
    return;
  }
  const before = done.reduce((sum, e) => sum + e.file.size, 0);
  const after = done.reduce((sum, e) => sum + (e.blob?.size ?? 0), 0);
  totals.textContent = `${done.length} image${done.length === 1 ? '' : 's'} · ${describeSizes(before, after)}`;
}

// --- resizing --------------------------------------------------------------------

function encodeCanvas(target: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    target.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageError(`This browser could not encode the image as ${type}.`));
      },
      type,
      quality,
    );
  });
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(
      `“${file.name}” could not be decoded — it may be corrupt, or a format this browser cannot open.`,
    );
  }
}

interface Resized {
  blob: Blob;
  type: string;
  source: Dimensions;
  crop: CropRect;
  target: Dimensions;
}

async function resize(file: File, options: Options): Promise<Resized> {
  const bitmap = await decode(file);
  try {
    const source = { width: bitmap.width, height: bitmap.height };
    const crop = resolveCrop(source, options.cropId, options.customCrop);
    const target = resolveTarget(options.mode, crop, {
      width: options.width,
      height: options.height,
      percent: options.percent,
      preset: options.preset,
    });
    const type = resolveOutputType(file.type, options.format);

    const out = document.createElement('canvas');
    out.width = target.width;
    out.height = target.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new ImageError('This browser refused to create a 2D canvas context.');
    if (type === 'image/jpeg') {
      // JPEG has no alpha; without this, transparent pixels come out black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, target.width, target.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      target.width,
      target.height,
    );

    const blob = await encodeCanvas(out, type, qualityFor(type, options.quality));
    return { blob, type: blob.type === '' ? type : blob.type, source, crop, target };
  } finally {
    bitmap.close();
  }
}

function applyResult(entry: Entry, result: Resized): void {
  entry.blob = result.blob;
  entry.name = resizedFileName(entry.file.name, result.target, result.type);
  setUrl(entry, URL.createObjectURL(result.blob));
  entry.thumb.src = entry.url ?? '';
  entry.meta.textContent =
    `${formatDimensions(result.source)} → ${formatDimensions(result.target)} · ` +
    `${describeSizes(entry.file.size, result.blob.size)}`;
  entry.button.disabled = false;
  entry.button.setAttribute('aria-label', `Download ${entry.name}`);
  entry.row.dataset.state = 'done';
}

function failRow(entry: Entry, err: unknown): void {
  entry.blob = undefined;
  entry.name = undefined;
  setUrl(entry, undefined);
  entry.thumb.removeAttribute('src');
  entry.meta.textContent = message(err);
  entry.button.disabled = true;
  entry.row.dataset.state = 'error';
}

async function processAll(): Promise<void> {
  const token = ++runToken;
  let options: Options;
  try {
    options = readOptions();
  } catch (err) {
    setStatus(status, message(err), 'error');
    return;
  }
  drawPreview();
  if (entries.length === 0) {
    setStatus(status, IDLE_STATUS);
    updateTotals();
    updateChrome();
    return;
  }

  let failures = 0;
  let firstError = '';
  for (const [index, entry] of entries.entries()) {
    if (token !== runToken) return;
    setStatus(status, `Resizing ${index + 1} of ${entries.length}: ${entry.file.name}…`);
    entry.meta.textContent = 'Resizing…';
    entry.row.dataset.state = 'busy';
    try {
      const result = await resize(entry.file, options);
      if (token !== runToken) return;
      applyResult(entry, result);
    } catch (err) {
      if (token !== runToken) return;
      failRow(entry, err);
      failures++;
      if (firstError === '') firstError = message(err);
    }
    updateTotals();
    updateChrome();
  }
  if (token !== runToken) return;

  const ok = entries.length - failures;
  if (failures > 0) {
    // With one bad file the real reason is far more useful than a count.
    const detail = failures === 1 ? firstError : `${failures} files could not be processed.`;
    setStatus(status, `Resized ${ok} of ${entries.length} images — ${detail}`, 'error');
  } else {
    setStatus(status, `Resized ${ok} image${ok === 1 ? '' : 's'}. ${IDLE_STATUS}`, 'success');
  }
}

const reprocess = debounce(() => void processAll(), 200);

// --- input -----------------------------------------------------------------------

async function loadPreview(file: File): Promise<void> {
  try {
    const bitmap = await decode(file);
    preview?.bitmap.close();
    preview = { name: file.name, bitmap };
    // Seed the exact-size boxes from the first image so the defaults make sense.
    if (modeSelect.value === 'exact' && lockInput.checked) syncLocked('width');
    drawPreview();
  } catch {
    clearPreview();
  }
}

function addFiles(files: File[]): void {
  const rejected: string[] = [];
  const before = entries.length;
  for (const file of files) {
    try {
      assertUsableFile(file);
    } catch (err) {
      rejected.push(message(err));
      continue;
    }
    entries.push(createRow({ id: nextId++, file }));
  }
  updateChrome();
  if (rejected.length > 0) {
    setStatus(status, rejected.join(' '), 'error');
    if (entries.length === 0) return;
  }
  const first = entries[before];
  if (before === 0 && first) void loadPreview(first.file);
  void processAll();
}

function clearAll(): void {
  runToken++;
  for (const entry of entries) setUrl(entry, undefined);
  entries = [];
  list.replaceChildren();
  totals.textContent = '';
  fileInput.value = '';
  clearPreview();
  updateChrome();
  setStatus(status, IDLE_STATUS);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadEverything(): Promise<void> {
  const ready = entries.filter((e) => e.blob && e.name);
  for (const [index, entry] of ready.entries()) {
    if (entry.blob && entry.name) downloadBlob(entry.blob, entry.name);
    if (index < ready.length - 1) await delay(200);
  }
}

// --- events ----------------------------------------------------------------------

modeSelect.addEventListener('change', () => {
  syncAvailability();
  void processAll();
});
cropSelect.addEventListener('change', () => {
  syncAvailability();
  if (cropSelect.value === 'custom' && cropWidth.value === '') {
    cropWidth.value = String(preview?.bitmap.width ?? 0);
    cropHeight.value = String(preview?.bitmap.height ?? 0);
  }
  void processAll();
});
formatSelect.addEventListener('change', () => {
  syncAvailability();
  void processAll();
});
widthInput.addEventListener('input', () => {
  syncLocked('width');
  reprocess();
});
heightInput.addEventListener('input', () => {
  syncLocked('height');
  reprocess();
});
lockInput.addEventListener('change', () => {
  syncLocked('width');
  reprocess();
});
percentInput.addEventListener('input', reprocess);
presetSelect.addEventListener('change', () => void processAll());
for (const el of cropInputs) el.addEventListener('input', reprocess);
qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value;
  reprocess();
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files ?? []);
  if (files.length > 0) addFiles(files);
});

onFileDrop(root, (files) => {
  addFiles(files);
});

root.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;
  switch (button.dataset.action) {
    case 'clear':
      clearAll();
      break;
    case 'download-all':
      void downloadEverything();
      break;
    case 'download': {
      const entry = entries.find((item) => String(item.id) === button.dataset.id);
      if (entry?.blob && entry.name) downloadBlob(entry.blob, entry.name);
      break;
    }
  }
});

syncAvailability();
updateChrome();
