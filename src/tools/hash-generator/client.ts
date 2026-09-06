import {
  $,
  $$,
  copyText,
  debounce,
  flashButton,
  formatBytes,
  onFileDrop,
  setStatus,
} from '@/lib/dom';

import {
  ALGORITHMS,
  type AlgorithmId,
  type DigestTable,
  chunkBlob,
  compareDigest,
  digestChunks,
  digestText,
  formatDigest,
} from './logic';

const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const PLACEHOLDER = 'Type or paste text, or drop a file anywhere on this tool…';

const root = $<HTMLElement>('[data-tool="hash-generator"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const inputStats = $('[data-input-stats]', root);
const progress = $('[data-progress]', root);
const status = $('[data-status]', root);
const fileInput = $<HTMLInputElement>('[data-file]', root);
const uppercase = $<HTMLInputElement>('[data-opt="uppercase"]', root);
const base64 = $<HTMLInputElement>('[data-opt="base64"]', root);
const hmac = $<HTMLInputElement>('[data-opt="hmac"]', root);
const secret = $<HTMLInputElement>('[data-opt="secret"]', root);
const secretWrap = $<HTMLElement>('[data-secret-wrap]', root);
const compare = $<HTMLInputElement>('[data-compare]', root);
const verdict = $<HTMLElement>('[data-verdict]', root);
const digestCells = new Map<AlgorithmId, HTMLOutputElement>(
  $$<HTMLOutputElement>('[data-digest]', root).map((el) => [el.dataset.digest as AlgorithmId, el]),
);

const encoder = new TextEncoder();

/** Raw hex digests of the current input (null = HMAC not available for that row). */
let table: Partial<DigestTable> = {};
/** A dropped/uploaded file being hashed instead of the textarea. */
let fileSource: File | null = null;
/** Increments on every run so a slow file hash cannot overwrite a newer result. */
let runId = 0;

function hmacKey(): string | undefined {
  return hmac.checked && secret.value !== '' ? secret.value : undefined;
}

function renderTable(): void {
  const opts = { uppercase: uppercase.checked, base64: base64.checked };
  for (const algo of ALGORITHMS) {
    const cell = digestCells.get(algo.id);
    if (!cell) continue;
    const digest = table[algo.id];
    const row = cell.closest('tr');
    if (digest === undefined) {
      cell.textContent = '';
      cell.dataset.state = 'empty';
    } else if (digest === null) {
      cell.textContent = 'Not available with HMAC';
      cell.dataset.state = 'na';
    } else {
      cell.textContent = formatDigest(digest, opts);
      cell.dataset.state = 'ready';
    }
    row
      ?.querySelector<HTMLButtonElement>('[data-action="copy-row"]')
      ?.toggleAttribute('disabled', typeof digest !== 'string');
  }
  renderVerdict();
}

function renderVerdict(): void {
  const result = compareDigest(table, compare.value);
  compare.removeAttribute('aria-invalid');
  switch (result.status) {
    case 'empty':
      verdict.textContent = '';
      delete verdict.dataset.tone;
      break;
    case 'match':
      verdict.textContent = `Match — ${result.label}`;
      verdict.dataset.tone = 'success';
      break;
    case 'no-match':
      verdict.textContent = 'No match — the expected hash differs from every digest above.';
      verdict.dataset.tone = 'error';
      compare.setAttribute('aria-invalid', 'true');
      break;
  }
}

async function run(): Promise<void> {
  const id = ++runId;
  const key = hmacKey();
  try {
    if (fileSource) {
      const file = fileSource;
      inputStats.textContent = `${file.name} · ${formatBytes(file.size)}`;
      progress.textContent = `Hashing… 0%`;
      const result = await digestChunks(chunkBlob(file), { hmacKey: key }, (done) => {
        if (id !== runId) return;
        const pct = file.size === 0 ? 100 : Math.round((done / file.size) * 100);
        progress.textContent = `Hashing… ${pct}% (${formatBytes(done)} of ${formatBytes(file.size)})`;
      });
      if (id !== runId) return;
      table = result;
      progress.textContent = '';
      renderTable();
      setStatus(status, `Hashed “${file.name}” (${formatBytes(file.size)}) locally.`, 'success');
      return;
    }

    const text = input.value;
    const bytes = encoder.encode(text);
    inputStats.textContent =
      text.length === 0
        ? ''
        : `${text.length.toLocaleString()} chars · ${formatBytes(bytes.length)}`;
    const result = await digestText(text, { hmacKey: key });
    if (id !== runId) return;
    table = result;
    progress.textContent = '';
    renderTable();
    setStatus(status, key ? 'HMAC digests use your secret key — it never leaves this page.' : '');
  } catch (err) {
    if (id !== runId) return;
    table = {};
    progress.textContent = '';
    renderTable();
    setStatus(status, err instanceof Error ? err.message : 'Could not compute hashes.', 'error');
  }
}

const runDebounced = debounce(() => void run(), 80);

function clearFileSource(): void {
  fileSource = null;
  fileInput.value = '';
  input.placeholder = PLACEHOLDER;
  input.disabled = false;
}

function loadFile(file: File): void {
  fileSource = file;
  input.value = '';
  input.placeholder = `File loaded: ${file.name}. Click Clear to hash text instead.`;
  void run();
}

function updateHmacVisibility(): void {
  secretWrap.hidden = !hmac.checked;
  if (hmac.checked) secret.focus();
}

// --- events -----------------------------------------------------------------

input.addEventListener('input', () => {
  if (fileSource) clearFileSource();
  runDebounced();
});
uppercase.addEventListener('change', renderTable);
base64.addEventListener('change', renderTable);
hmac.addEventListener('change', () => {
  updateHmacVisibility();
  void run();
});
secret.addEventListener('input', runDebounced);
compare.addEventListener('input', debounce(renderVerdict, 60));

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) loadFile(file);
});

onFileDrop(root, (files) => {
  const file = files[0];
  if (file) loadFile(file);
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      clearFileSource();
      input.value = SAMPLE;
      void run();
      input.focus();
      break;

    case 'clear':
      clearFileSource();
      input.value = '';
      compare.value = '';
      void run();
      input.focus();
      break;

    case 'copy-row': {
      const algo = button.dataset.algo as AlgorithmId | undefined;
      const cell = algo ? digestCells.get(algo) : undefined;
      if (!cell || cell.dataset.state !== 'ready' || !cell.textContent) return;
      const ok = await copyText(cell.textContent);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the digest and copy manually.',
          'error',
        );
      break;
    }
  }
});

updateHmacVisibility();
void run();
