import { $, debounce, downloadBlob, formatBytes, onFileDrop, setStatus } from '@/lib/dom';

import {
  ImageError,
  type OutputFormat,
  assertUsableFile,
  describeSizes,
  fitWithin,
  formatDimensions,
  outputFileName,
  parseLimit,
  parseQuality,
  qualityFor,
  resolveOutputType,
  summarise,
} from './logic';

const IDLE_STATUS = 'Images are compressed on your device and never leave your browser.';

interface Options {
  quality: number;
  format: OutputFormat;
  maxWidth?: number | undefined;
  maxHeight?: number | undefined;
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

const root = $<HTMLElement>('[data-tool="image-compressor"]');
const fileInput = $<HTMLInputElement>('[data-file]', root);
const list = $<HTMLOListElement>('[data-results]', root);
const empty = $('[data-empty]', root);
const totals = $('[data-totals]', root);
const status = $('[data-status]', root);
const qualityInput = $<HTMLInputElement>('[data-opt="quality"]', root);
const qualityValue = $('[data-quality]', root);
const formatSelect = $<HTMLSelectElement>('[data-opt="format"]', root);
const maxWidthInput = $<HTMLInputElement>('[data-opt="max-width"]', root);
const maxHeightInput = $<HTMLInputElement>('[data-opt="max-height"]', root);
const downloadAll = $<HTMLButtonElement>('[data-action="download-all"]', root);
const clearButton = $<HTMLButtonElement>('[data-action="clear"]', root);

let entries: Entry[] = [];
let nextId = 0;
/** Bumped on every run so a slow batch never overwrites a newer one. */
let runToken = 0;

// --- options ---------------------------------------------------------------------

function readOptions(): Options {
  return {
    quality: parseQuality(qualityInput.value),
    format: formatSelect.value as OutputFormat,
    maxWidth: parseLimit(maxWidthInput.value, 'Max width'),
    maxHeight: parseLimit(maxHeightInput.value, 'Max height'),
  };
}

function message(err: unknown): string {
  if (err instanceof ImageError) return err.message;
  if (err instanceof Error) return `Could not process the image: ${err.message}`;
  return 'Could not process the image.';
}

// --- rows ------------------------------------------------------------------------

function createRow(entry: Omit<Entry, 'row' | 'thumb' | 'meta' | 'button'>): Entry {
  const row = document.createElement('li');
  row.className = 'tool-image-compressor__row';

  const thumb = document.createElement('img');
  thumb.className = 'tool-image-compressor__thumb';
  thumb.width = 56;
  thumb.height = 56;
  thumb.alt = '';
  thumb.decoding = 'async';

  const info = document.createElement('div');
  info.className = 'tool-image-compressor__info';

  const name = document.createElement('p');
  name.className = 'tool-image-compressor__name';
  name.textContent = entry.file.name;

  const meta = document.createElement('p');
  meta.className = 'tool-image-compressor__meta';
  meta.dataset.rowMeta = '';
  meta.textContent = `${formatBytes(entry.file.size)} · queued`;

  info.append(name, meta);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm tool-image-compressor__download';
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
  const ready = entries.some((e) => e.blob !== undefined);
  empty.hidden = entries.length > 0;
  downloadAll.disabled = !ready;
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
  const summary = summarise(before, after);
  totals.textContent =
    `${done.length} image${done.length === 1 ? '' : 's'} · ` +
    `${describeSizes(before, after)} · ${summary.larger ? 'no saving' : `${summary.percent}% smaller`}`;
}

// --- compression -----------------------------------------------------------------

interface Encoded {
  blob: Blob;
  type: string;
  dimensions: { width: number; height: number };
  resized: boolean;
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

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(
      `“${file.name}” could not be decoded — it may be corrupt, or a format this browser cannot open.`,
    );
  }
}

async function compress(file: File, options: Options): Promise<Encoded> {
  const bitmap = await decode(file);
  try {
    const source = { width: bitmap.width, height: bitmap.height };
    const target = fitWithin(source, { maxWidth: options.maxWidth, maxHeight: options.maxHeight });
    const type = resolveOutputType(file.type, options.format);

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('This browser refused to create a 2D canvas context.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await encode(canvas, type, qualityFor(type, options.quality));
    return {
      blob,
      type: blob.type === '' ? type : blob.type,
      dimensions: target,
      resized: target.width !== source.width || target.height !== source.height,
    };
  } finally {
    bitmap.close();
  }
}

function applyResult(entry: Entry, result: Encoded): void {
  const summary = summarise(entry.file.size, result.blob.size);
  // Only offer the original when we were not asked to resize — a smaller
  // canvas is what the user wanted even if its encoding happens to be bigger.
  const useOriginal = summary.larger && !result.resized;
  const blob = useOriginal ? entry.file : result.blob;

  entry.blob = blob;
  entry.name = useOriginal ? entry.file.name : outputFileName(entry.file.name, result.type);
  setUrl(entry, URL.createObjectURL(blob));
  entry.thumb.src = entry.url ?? '';

  const verdict = useOriginal
    ? 'already optimised — original offered'
    : summary.larger
      ? `${Math.abs(summary.percent)}% larger`
      : summary.label;
  entry.meta.textContent =
    `${describeSizes(entry.file.size, blob.size)} · ` +
    `${formatDimensions(result.dimensions)} · ${verdict}`;

  entry.button.disabled = false;
  entry.button.setAttribute('aria-label', `Download ${entry.name}`);
  entry.row.dataset.state = useOriginal ? 'original' : 'done';
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
    setStatus(status, `Compressing ${index + 1} of ${entries.length}: ${entry.file.name}…`);
    entry.meta.textContent = 'Compressing…';
    entry.row.dataset.state = 'busy';
    try {
      const result = await compress(entry.file, options);
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
      `Compressed ${ok} of ${entries.length} images — ${failures} could not be read.`,
      'error',
    );
  } else {
    setStatus(status, `Compressed ${ok} image${ok === 1 ? '' : 's'}. ${IDLE_STATUS}`, 'success');
  }
}

const reprocess = debounce(() => void processAll(), 200);

// --- input -----------------------------------------------------------------------

function addFiles(files: File[]): void {
  const rejected: string[] = [];
  let added = 0;
  for (const file of files) {
    try {
      assertUsableFile(file);
    } catch (err) {
      rejected.push(message(err));
      continue;
    }
    entries.push(createRow({ id: nextId++, file }));
    added++;
  }
  updateChrome();
  if (rejected.length > 0) {
    setStatus(status, rejected.join(' '), 'error');
    if (added === 0) return;
    // Still compress whatever was valid, then the run's own status takes over.
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

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value;
  reprocess();
});
formatSelect.addEventListener('change', () => void processAll());
for (const input of [maxWidthInput, maxHeightInput]) {
  input.addEventListener('input', reprocess);
}

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

updateChrome();
