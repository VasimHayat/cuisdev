import {
  $,
  $$,
  copyText,
  debounce,
  downloadBlob,
  downloadText,
  flashButton,
  onFileDrop,
  setStatus,
} from '@/lib/dom';

import {
  ImageError,
  SAMPLE_PNG_BASE64,
  type Snippets,
  assertUsableFile,
  base64ToBytes,
  baseName,
  buildSnippets,
  bytesToBase64,
  describeEncoding,
  downloadNameFor,
  formatBytes,
  formatLabel,
  isOversized,
  oversizeWarning,
  parseDataUrl,
  sniffMime,
  toDataUrl,
} from './logic';

const IDLE_STATUS = 'Images are encoded on your device and never leave your browser.';

type Mode = 'encode' | 'decode';

interface Entry {
  id: number;
  file: File;
  row: HTMLLIElement;
  thumb: HTMLImageElement;
  meta: HTMLElement;
  select: HTMLButtonElement;
  download: HTMLButtonElement;
  url?: string | undefined;
  mime?: string | undefined;
  snippets?: Snippets | undefined;
}

const root = $<HTMLElement>('[data-tool="image-to-base64"]');
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);
const encodePanel = $('[data-panel="encode"]', root);
const decodePanel = $('[data-panel="decode"]', root);
const fileInput = $<HTMLInputElement>('[data-file]', root);
const list = $<HTMLOListElement>('[data-results]', root);
const empty = $('[data-empty]', root);
const totals = $('[data-totals]', root);
const status = $('[data-status]', root);
const selectedName = $('[data-selected-name]', root);
const warning = $('[data-warning]', root);
const copyButtons = $$<HTMLButtonElement>('[data-action="copy"]', root);
const outputs = $$<HTMLTextAreaElement>('[data-out]', root);
const downloadAll = $<HTMLButtonElement>('[data-action="download-all"]', root);
const clearButton = $<HTMLButtonElement>('[data-action="clear"]', root);

const decodeInput = $<HTMLTextAreaElement>('[data-decode-input]', root);
const decoded = $<HTMLImageElement>('[data-decoded]', root);
const decodePlaceholder = $('[data-decode-placeholder]', root);
const decodeStats = $('[data-decode-stats]', root);
const decodeDownload = $<HTMLButtonElement>('[data-action="decode-download"]', root);

let entries: Entry[] = [];
let nextId = 0;
let selectedId: number | null = null;
let runToken = 0;
let decodedResult: { blob: Blob; name: string } | null = null;
let decodedUrl: string | null = null;

// --- mode ------------------------------------------------------------------------

function mode(): Mode {
  return modeInputs.find((r) => r.checked)?.value === 'decode' ? 'decode' : 'encode';
}

function syncMode(): void {
  const decoding = mode() === 'decode';
  encodePanel.hidden = decoding;
  decodePanel.hidden = !decoding;
  setStatus(
    status,
    decoding ? 'Base64 is decoded on your device and never leaves your browser.' : IDLE_STATUS,
  );
}

function message(err: unknown): string {
  if (err instanceof ImageError) return err.message;
  if (err instanceof Error) return `Could not process the image: ${err.message}`;
  return 'Could not process the image.';
}

/**
 * Flash "Copied!". Each Copy button carries an `aria-label` so the five of them
 * are distinguishable, and an aria-label wins over visible text — so it has to
 * be swapped too, or screen-reader users never hear the confirmation.
 */
function flashCopy(button: HTMLButtonElement): void {
  const original = button.getAttribute('aria-label');
  flashButton(button);
  if (original === null) return;
  button.setAttribute('aria-label', 'Copied!');
  window.setTimeout(() => button.setAttribute('aria-label', original), 1500);
}

// --- encode: rows ------------------------------------------------------------------

function createRow(entry: Omit<Entry, 'row' | 'thumb' | 'meta' | 'select' | 'download'>): Entry {
  const row = document.createElement('li');
  row.className = 'tool-image-to-base64__row';

  const thumb = document.createElement('img');
  thumb.className = 'tool-image-to-base64__thumb';
  thumb.width = 56;
  thumb.height = 56;
  thumb.alt = '';
  thumb.decoding = 'async';

  const info = document.createElement('div');
  info.className = 'tool-image-to-base64__info';

  const name = document.createElement('p');
  name.className = 'tool-image-to-base64__name';
  name.textContent = entry.file.name;

  const meta = document.createElement('p');
  meta.className = 'tool-image-to-base64__meta';
  meta.dataset.rowMeta = '';
  meta.textContent = `${formatBytes(entry.file.size)} · encoding…`;

  info.append(name, meta);

  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'btn btn--ghost btn--sm';
  select.dataset.action = 'select';
  select.dataset.id = String(entry.id);
  select.textContent = 'Show';
  select.setAttribute('aria-pressed', 'false');
  select.setAttribute('aria-label', `Show snippets for ${entry.file.name}`);

  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'btn btn--sm';
  download.dataset.action = 'download';
  download.dataset.id = String(entry.id);
  download.disabled = true;
  download.textContent = 'Download';
  download.setAttribute('aria-label', `Download the data URL for ${entry.file.name}`);

  const actions = document.createElement('div');
  actions.className = 'tool-image-to-base64__row-actions';
  actions.append(select, download);

  row.append(thumb, info, actions);
  list.append(row);
  return { ...entry, row, thumb, meta, select, download };
}

function updateChrome(): void {
  empty.hidden = entries.length > 0;
  downloadAll.disabled = !entries.some((e) => e.snippets !== undefined);
  clearButton.disabled = entries.length === 0;
}

function updateTotals(): void {
  const done = entries.filter((e) => e.snippets !== undefined);
  if (done.length === 0) {
    totals.textContent = '';
    return;
  }
  const raw = done.reduce((sum, e) => sum + e.file.size, 0);
  const encoded = done.reduce((sum, e) => sum + (e.snippets?.dataUrl.length ?? 0), 0);
  totals.textContent =
    `${done.length} image${done.length === 1 ? '' : 's'} · ` +
    `${formatBytes(raw)} → ${formatBytes(encoded)} of data URLs`;
}

function showSnippets(): void {
  const entry = entries.find((e) => e.id === selectedId);
  for (const button of copyButtons) button.disabled = !entry?.snippets;
  for (const el of entries) {
    el.select.setAttribute('aria-pressed', el.id === selectedId ? 'true' : 'false');
    el.row.dataset.selected = el.id === selectedId ? 'true' : 'false';
  }
  if (!entry?.snippets) {
    for (const out of outputs) out.value = '';
    selectedName.textContent = '';
    warning.hidden = true;
    warning.textContent = '';
    return;
  }
  const snippets = entry.snippets;
  for (const out of outputs) {
    const key = out.dataset.out as keyof Snippets | undefined;
    out.value = key ? snippets[key] : '';
  }
  selectedName.textContent = `${entry.file.name} · ${formatLabel(entry.mime ?? '')}`;
  const oversized = isOversized(snippets.dataUrl.length);
  warning.hidden = !oversized;
  warning.textContent = oversized ? oversizeWarning(snippets.dataUrl.length) : '';
}

// --- encode: work ------------------------------------------------------------------

async function dimensionsOf(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const label = `${bitmap.width} × ${bitmap.height}`;
    bitmap.close();
    return label;
  } catch {
    // SVG and some exotic formats cannot go through createImageBitmap.
    return '';
  }
}

async function encodeEntry(entry: Entry): Promise<void> {
  const bytes = new Uint8Array(await entry.file.arrayBuffer());
  const base64 = bytesToBase64(bytes);
  const mime = entry.file.type.startsWith('image/')
    ? entry.file.type
    : sniffMime(bytes) || 'application/octet-stream';
  const snippets = buildSnippets({ name: entry.file.name, mime, base64 });
  const size = await dimensionsOf(entry.file);

  entry.mime = mime;
  entry.snippets = snippets;
  entry.url = URL.createObjectURL(entry.file);
  entry.thumb.src = entry.url;
  entry.meta.textContent = [describeEncoding(mime, entry.file.size, snippets.dataUrl.length), size]
    .filter(Boolean)
    .join(' · ');
  entry.download.disabled = false;
  entry.row.dataset.state = 'done';
}

function failRow(entry: Entry, err: unknown): void {
  entry.snippets = undefined;
  entry.meta.textContent = message(err);
  entry.download.disabled = true;
  entry.row.dataset.state = 'error';
}

async function processAll(): Promise<void> {
  const token = ++runToken;
  if (entries.length === 0) {
    updateTotals();
    updateChrome();
    showSnippets();
    return;
  }
  let failures = 0;
  for (const [index, entry] of entries.entries()) {
    if (token !== runToken) return;
    if (entry.snippets) continue;
    setStatus(status, `Encoding ${index + 1} of ${entries.length}: ${entry.file.name}…`);
    try {
      await encodeEntry(entry);
      if (token !== runToken) return;
    } catch (err) {
      if (token !== runToken) return;
      failRow(entry, err);
      failures++;
    }
    if (selectedId === null && entry.snippets) selectedId = entry.id;
    updateTotals();
    updateChrome();
    showSnippets();
  }
  if (token !== runToken) return;

  const ok = entries.filter((e) => e.snippets).length;
  if (failures > 0) {
    setStatus(status, `Encoded ${ok} of ${entries.length} images — ${failures} failed.`, 'error');
  } else {
    setStatus(status, `Encoded ${ok} image${ok === 1 ? '' : 's'}. ${IDLE_STATUS}`, 'success');
  }
}

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
  }
  void processAll();
}

function clearAll(): void {
  runToken++;
  for (const entry of entries) if (entry.url) URL.revokeObjectURL(entry.url);
  entries = [];
  selectedId = null;
  list.replaceChildren();
  totals.textContent = '';
  fileInput.value = '';
  updateChrome();
  showSnippets();
  setStatus(status, IDLE_STATUS);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadEverything(): Promise<void> {
  const ready = entries.filter((e) => e.snippets);
  for (const [index, entry] of ready.entries()) {
    if (entry.snippets) {
      downloadText(entry.snippets.dataUrl, `${baseName(entry.file.name)}-base64.txt`);
    }
    if (index < ready.length - 1) await delay(200);
  }
}

function loadSample(): void {
  const bytes = base64ToBytes(SAMPLE_PNG_BASE64);
  const file = new File([bytes], 'sample-checkerboard.png', { type: 'image/png' });
  addFiles([file]);
}

// --- decode ------------------------------------------------------------------------

function resetDecode(): void {
  if (decodedUrl) URL.revokeObjectURL(decodedUrl);
  decodedUrl = null;
  decodedResult = null;
  decoded.hidden = true;
  decoded.removeAttribute('src');
  decodePlaceholder.hidden = false;
  decodeStats.textContent = '';
  decodeDownload.disabled = true;
}

function runDecode(): void {
  if (decodeInput.value.trim() === '') {
    resetDecode();
    setStatus(status, 'Base64 is decoded on your device and never leaves your browser.');
    return;
  }
  try {
    const parsed = parseDataUrl(decodeInput.value);
    resetDecode();
    const blob = new Blob([parsed.bytes], { type: parsed.mime });
    decodedUrl = URL.createObjectURL(blob);
    decodedResult = { blob, name: downloadNameFor(parsed.mime) };
    decoded.src = decodedUrl;
    decoded.hidden = false;
    decodePlaceholder.hidden = true;
    decodeDownload.disabled = false;
    decodeStats.textContent =
      `${formatLabel(parsed.mime)} · ${formatBytes(parsed.bytes.length)} · ` +
      `${parsed.base64.length.toLocaleString()} Base64 characters`;
    setStatus(
      status,
      parsed.sniffed
        ? `Detected ${formatLabel(parsed.mime)} from the file signature in the decoded bytes.`
        : `Decoded a ${formatLabel(parsed.mime)} image.`,
      'success',
    );
  } catch (err) {
    resetDecode();
    setStatus(status, message(err), 'error');
  }
}

decoded.addEventListener('load', () => {
  if (decoded.naturalWidth > 0) {
    decodeStats.textContent = `${decodeStats.textContent} · ${decoded.naturalWidth} × ${decoded.naturalHeight}`;
  }
});

// --- events ------------------------------------------------------------------------

for (const radio of modeInputs) radio.addEventListener('change', syncMode);
decodeInput.addEventListener('input', debounce(runDecode, 120));

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files ?? []);
  if (files.length > 0) addFiles(files);
});

onFileDrop(root, (files) => {
  if (mode() === 'encode') addFiles(files);
});

root.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;
  switch (button.dataset.action) {
    case 'sample':
      loadSample();
      break;

    case 'clear':
      clearAll();
      break;

    case 'select': {
      const entry = entries.find((item) => String(item.id) === button.dataset.id);
      if (entry) selectedId = entry.id;
      showSnippets();
      break;
    }

    case 'download': {
      const entry = entries.find((item) => String(item.id) === button.dataset.id);
      if (entry?.snippets) {
        downloadText(entry.snippets.dataUrl, `${baseName(entry.file.name)}-base64.txt`);
      }
      break;
    }

    case 'download-all':
      void downloadEverything();
      break;

    case 'copy': {
      const key = button.dataset.copy as keyof Snippets | undefined;
      const entry = entries.find((item) => item.id === selectedId);
      const text = key && entry?.snippets ? entry.snippets[key] : '';
      if (!text) return;
      void copyText(text).then((ok) => {
        if (ok) flashCopy(button);
        else
          setStatus(
            status,
            'Clipboard access was blocked — select the text and copy it manually.',
            'error',
          );
      });
      break;
    }

    case 'decode-sample':
      decodeInput.value = toDataUrl('image/png', SAMPLE_PNG_BASE64);
      runDecode();
      break;

    case 'decode-clear':
      decodeInput.value = '';
      runDecode();
      decodeInput.focus();
      break;

    case 'decode-download':
      if (decodedResult) downloadBlob(decodedResult.blob, decodedResult.name);
      break;
  }
});

syncMode();
updateChrome();
showSnippets();
