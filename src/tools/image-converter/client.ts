import { $, debounce, downloadBlob, formatBytes, onFileDrop, setStatus } from '@/lib/dom';

import {
  ImageError,
  type TargetFormat,
  assertUsableFile,
  convertedFileName,
  describeConversion,
  describeSizes,
  fallbackDimensions,
  formatDimensions,
  formatLabel,
  isLossy,
  isNoOp,
  needsBackground,
  normalizeHexColor,
  parseQuality,
  qualityFor,
  sourceType,
} from './logic';

const IDLE_STATUS = 'Images are converted on your device and never leave your browser.';

interface Options {
  target: TargetFormat;
  quality: number;
  background: string;
}

interface Entry {
  id: number;
  file: File;
  from: string;
  row: HTMLLIElement;
  thumb: HTMLImageElement;
  meta: HTMLElement;
  button: HTMLButtonElement;
  url?: string | undefined;
  blob?: Blob | undefined;
  name?: string | undefined;
}

const root = $<HTMLElement>('[data-tool="image-converter"]');
const fileInput = $<HTMLInputElement>('[data-file]', root);
const list = $<HTMLOListElement>('[data-results]', root);
const empty = $('[data-empty]', root);
const totals = $('[data-totals]', root);
const status = $('[data-status]', root);
const targetSelect = $<HTMLSelectElement>('[data-opt="target"]', root);
const qualityInput = $<HTMLInputElement>('[data-opt="quality"]', root);
const qualityValue = $('[data-quality]', root);
const backgroundInput = $<HTMLInputElement>('[data-opt="background"]', root);
const avifOption = $<HTMLOptionElement>('option[data-avif]', root);
const downloadAll = $<HTMLButtonElement>('[data-action="download-all"]', root);
const clearButton = $<HTMLButtonElement>('[data-action="clear"]', root);

let entries: Entry[] = [];
let nextId = 0;
let runToken = 0;

// --- options ---------------------------------------------------------------------

function readOptions(): Options {
  return {
    target: targetSelect.value as TargetFormat,
    quality: parseQuality(qualityInput.value),
    background: normalizeHexColor(backgroundInput.value),
  };
}

function message(err: unknown): string {
  if (err instanceof ImageError) return err.message;
  if (err instanceof Error) return `Could not convert the image: ${err.message}`;
  return 'Could not convert the image.';
}

/** Grey out the options the chosen target ignores, rather than moving them. */
function syncOptionAvailability(): void {
  const target = targetSelect.value;
  qualityInput.disabled = !isLossy(target);
  backgroundInput.disabled = !needsBackground(target);
}

/** Only offer AVIF when this browser's canvas can really encode it. */
async function detectAvif(): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const supported = await new Promise<boolean>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob?.type === 'image/avif'), 'image/avif', 0.5);
    } catch {
      resolve(false);
    }
  });
  if (!supported) {
    if (targetSelect.value === 'image/avif') targetSelect.value = 'image/webp';
    avifOption.remove();
    syncOptionAvailability();
  }
}

// --- rows ------------------------------------------------------------------------

function createRow(entry: Omit<Entry, 'row' | 'thumb' | 'meta' | 'button'>): Entry {
  const row = document.createElement('li');
  row.className = 'tool-image-converter__row';

  const thumb = document.createElement('img');
  thumb.className = 'tool-image-converter__thumb';
  thumb.width = 56;
  thumb.height = 56;
  thumb.alt = '';
  thumb.decoding = 'async';

  const info = document.createElement('div');
  info.className = 'tool-image-converter__info';

  const name = document.createElement('p');
  name.className = 'tool-image-converter__name';
  name.textContent = entry.file.name;

  const meta = document.createElement('p');
  meta.className = 'tool-image-converter__meta';
  meta.dataset.rowMeta = '';
  meta.textContent = `${formatLabel(entry.from)} · ${formatBytes(entry.file.size)} · queued`;

  info.append(name, meta);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm tool-image-converter__download';
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
  totals.textContent =
    `${done.length} file${done.length === 1 ? '' : 's'} converted to ` +
    `${formatLabel(targetSelect.value)} · ${describeSizes(before, after)}`;
}

// --- conversion ------------------------------------------------------------------

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

/** SVG and some ICO files cannot go through createImageBitmap; <img> can read them. */
function decodeWithImage(file: File): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener('load', () => {
      const size = fallbackDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      resolve({
        source: image,
        width: size.width,
        height: size.height,
        release: () => URL.revokeObjectURL(url),
      });
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(
        new ImageError(
          `“${file.name}” could not be decoded — it may be corrupt or use a format this browser cannot open.`,
        ),
      );
    });
    image.src = url;
  });
}

async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    return decodeWithImage(file);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageError(`This browser could not encode the image as ${type}.`));
      },
      type,
      quality,
    );
  });
}

interface Converted {
  blob: Blob;
  type: string;
  dimensions: { width: number; height: number };
}

async function convert(file: File, options: Options): Promise<Converted> {
  const decoded = await decode(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('This browser refused to create a 2D canvas context.');
    if (needsBackground(options.target)) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);

    let blob: Blob;
    try {
      blob = await encode(canvas, options.target, qualityFor(options.target, options.quality));
    } catch (err) {
      if (err instanceof ImageError) throw err;
      throw new ImageError(
        `“${file.name}” could not be exported — the browser blocked reading the canvas back (this happens with some SVG files).`,
      );
    }
    return {
      blob,
      type: blob.type === '' ? options.target : blob.type,
      dimensions: { width: decoded.width, height: decoded.height },
    };
  } finally {
    decoded.release();
  }
}

function applyResult(entry: Entry, result: Converted): void {
  entry.blob = result.blob;
  entry.name = convertedFileName(entry.file.name, result.type);
  setUrl(entry, URL.createObjectURL(result.blob));
  entry.thumb.src = entry.url ?? '';

  const note = isNoOp(entry.from, result.type) ? ' · same format, re-encoded' : '';
  entry.meta.textContent =
    `${describeConversion(entry.from, result.type)} · ` +
    `${describeSizes(entry.file.size, result.blob.size)} · ` +
    `${formatDimensions(result.dimensions)}${note}`;

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
  if (entries.length === 0) {
    setStatus(status, IDLE_STATUS);
    updateTotals();
    updateChrome();
    return;
  }

  let failures = 0;
  for (const [index, entry] of entries.entries()) {
    if (token !== runToken) return;
    setStatus(status, `Converting ${index + 1} of ${entries.length}: ${entry.file.name}…`);
    entry.meta.textContent = `Converting to ${formatLabel(options.target)}…`;
    entry.row.dataset.state = 'busy';
    try {
      const result = await convert(entry.file, options);
      if (token !== runToken) return;
      applyResult(entry, result);
    } catch (err) {
      if (token !== runToken) return;
      failRow(entry, err);
      failures++;
    }
    updateTotals();
    updateChrome();
  }
  if (token !== runToken) return;

  const ok = entries.length - failures;
  if (failures > 0) {
    setStatus(
      status,
      `Converted ${ok} of ${entries.length} images — ${failures} could not be read.`,
      'error',
    );
  } else {
    setStatus(
      status,
      `Converted ${ok} image${ok === 1 ? '' : 's'} to ${formatLabel(options.target)}. ${IDLE_STATUS}`,
      'success',
    );
  }
}

const reprocess = debounce(() => void processAll(), 200);

// --- input -----------------------------------------------------------------------

function addFiles(files: File[]): void {
  const rejected: string[] = [];
  for (const file of files) {
    try {
      assertUsableFile(file);
    } catch (err) {
      rejected.push(message(err));
      continue;
    }
    entries.push(createRow({ id: nextId++, file, from: sourceType(file) }));
  }
  updateChrome();
  if (rejected.length > 0) {
    setStatus(status, rejected.join(' '), 'error');
    if (entries.length === 0) return;
  }
  void processAll();
}

function clearAll(): void {
  runToken++;
  for (const entry of entries) setUrl(entry, undefined);
  entries = [];
  list.replaceChildren();
  totals.textContent = '';
  fileInput.value = '';
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

targetSelect.addEventListener('change', () => {
  syncOptionAvailability();
  void processAll();
});
qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value;
  reprocess();
});
backgroundInput.addEventListener('input', reprocess);

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

syncOptionAvailability();
updateChrome();
void detectAvif();
