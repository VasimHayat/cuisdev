import {
  $,
  $$,
  copyText,
  debounce,
  downloadBlob,
  downloadText,
  flashButton,
  formatBytes,
  onFileDrop,
  setStatus,
} from '@/lib/dom';

import {
  Base64Error,
  base64ToBytes,
  bytesToBase64,
  decodeText,
  encodeText,
  sniffExtension,
} from './logic';

type Mode = 'encode' | 'decode';

const SAMPLE = { encode: 'Hello, World! 👋', decode: 'SGVsbG8sIFdvcmxkISDwn5GL' };
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const root = $<HTMLElement>('[data-tool="base64"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const fileInput = $<HTMLInputElement>('[data-file]', root);
const urlSafe = $<HTMLInputElement>('[data-opt="urlsafe"]', root);
const wrap = $<HTMLInputElement>('[data-opt="wrap"]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const encoder = new TextEncoder();

/** Bytes behind the current output when it is not representable as text. */
let binaryResult: Uint8Array<ArrayBuffer> | null = null;
/** Bytes of a dropped/uploaded file being encoded (input textarea is not the source). */
let fileSource: { name: string; bytes: Uint8Array } | null = null;

const mode = (): Mode => (modeInputs.find((r) => r.checked)?.value as Mode | undefined) ?? 'encode';

function setMode(next: Mode): void {
  for (const r of modeInputs) r.checked = r.value === next;
  updateLabels();
}

function updateLabels(): void {
  const encoding = mode() === 'encode';
  inputLabel.textContent = encoding ? 'Text to encode' : 'Base64 to decode';
  outputLabel.textContent = encoding ? 'Base64' : 'Decoded text';
  urlSafe.closest('label')?.toggleAttribute('hidden', !encoding);
  wrap.closest('label')?.toggleAttribute('hidden', !encoding);
}

function stats(el: HTMLElement, text: string, bytes?: number): void {
  if (text.length === 0 && bytes === undefined) {
    el.textContent = '';
    return;
  }
  const byteCount = bytes ?? encoder.encode(text).length;
  el.textContent = `${text.length.toLocaleString()} chars · ${formatBytes(byteCount)}`;
}

function run(): void {
  binaryResult = null;
  const options = { urlSafe: urlSafe.checked, wrapAt: wrap.checked ? 76 : 0 };

  if (mode() === 'encode') {
    if (fileSource) {
      output.value = bytesToBase64(fileSource.bytes, options);
      stats(inputStats, '', fileSource.bytes.length);
      inputStats.textContent = `${fileSource.name} · ${formatBytes(fileSource.bytes.length)}`;
      stats(outputStats, output.value);
      setStatus(status, `Encoded file “${fileSource.name}”.`, 'success');
      return;
    }
    output.value = encodeText(input.value, options);
    stats(inputStats, input.value);
    stats(outputStats, output.value);
    setStatus(status, '');
    return;
  }

  // decode
  stats(inputStats, input.value);
  if (input.value.trim() === '') {
    output.value = '';
    outputStats.textContent = '';
    setStatus(status, '');
    return;
  }
  try {
    output.value = decodeText(input.value);
    stats(outputStats, output.value);
    setStatus(status, '');
  } catch (err) {
    output.value = '';
    outputStats.textContent = '';
    if (err instanceof Base64Error && /not UTF-8 text/.test(err.message)) {
      binaryResult = base64ToBytes(input.value);
      outputStats.textContent = `${formatBytes(binaryResult.length)} of binary data · .${sniffExtension(binaryResult)}`;
    }
    setStatus(status, err instanceof Error ? err.message : 'Could not decode.', 'error');
  }
}

const runDebounced = debounce(run, 60);

function clearFileSource(): void {
  fileSource = null;
  fileInput.value = '';
}

async function loadFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) {
    setStatus(
      status,
      `File is too large (${formatBytes(file.size)}). Limit is ${formatBytes(MAX_FILE_BYTES)}.`,
      'error',
    );
    return;
  }
  if (mode() === 'decode') {
    input.value = await file.text();
    run();
    return;
  }
  fileSource = { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  input.value = '';
  input.placeholder = `File loaded: ${file.name}. Type here to encode text instead.`;
  run();
}

// --- events -----------------------------------------------------------------

input.addEventListener('input', () => {
  if (fileSource) {
    clearFileSource();
    input.placeholder = 'Type or paste here, or drop a file anywhere on this panel…';
  }
  runDebounced();
});

for (const r of modeInputs) {
  r.addEventListener('change', () => {
    clearFileSource();
    updateLabels();
    run();
  });
}
urlSafe.addEventListener('change', run);
wrap.addEventListener('change', run);

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file);
});

onFileDrop(root, (files) => {
  const file = files[0];
  if (file) void loadFile(file);
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      clearFileSource();
      input.value = SAMPLE[mode()];
      run();
      input.focus();
      break;

    case 'clear':
      clearFileSource();
      input.value = '';
      input.placeholder = 'Type or paste here, or drop a file anywhere on this panel…';
      run();
      input.focus();
      break;

    case 'copy': {
      if (!output.value) return;
      const ok = await copyText(output.value);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the output and copy manually.',
          'error',
        );
      break;
    }

    case 'download':
      if (binaryResult) {
        downloadBlob(new Blob([binaryResult]), `decoded.${sniffExtension(binaryResult)}`);
      } else if (output.value) {
        const name = mode() === 'encode' ? 'encoded.base64.txt' : 'decoded.txt';
        downloadText(output.value, name);
      }
      break;

    case 'swap': {
      if (!output.value) return;
      clearFileSource();
      const next: Mode = mode() === 'encode' ? 'decode' : 'encode';
      input.value = output.value;
      setMode(next);
      run();
      break;
    }
  }
});

updateLabels();
run();
