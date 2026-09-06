import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';

import {
  MAX_COUNT,
  MIN_COUNT,
  type OutputFormat,
  type UuidVersion,
  generateUuids,
  formatUuids,
  parseUuid,
} from './logic';

const root = $<HTMLElement>('[data-tool="uuid-generator"]');
const output = $<HTMLTextAreaElement>('[data-output]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const countInput = $<HTMLInputElement>('[data-opt="count"]', root);
const formatSelect = $<HTMLSelectElement>('[data-opt="format"]', root);
const uppercase = $<HTMLInputElement>('[data-opt="uppercase"]', root);
const hyphens = $<HTMLInputElement>('[data-opt="hyphens"]', root);
const quotes = $<HTMLInputElement>('[data-opt="quotes"]', root);
const versionInputs = $$<HTMLInputElement>('[data-version] input', root);

const inspectInput = $<HTMLInputElement>('[data-inspect]', root);
const inspectStatus = $('[data-inspect-status]', root);
const details = $<HTMLElement>('[data-details]', root);
const detailUuid = $('[data-detail="uuid"]', root);
const detailVersion = $('[data-detail="version"]', root);
const detailVariant = $('[data-detail="variant"]', root);
const detailTimestamp = $('[data-detail="timestamp"]', root);
const timestampRow = $<HTMLElement>('[data-detail-row="timestamp"]', root);

/** The last generated batch, kept raw so option changes re-format without regenerating. */
let batch: string[] = [];

const version = (): UuidVersion =>
  (versionInputs.find((r) => r.checked)?.value as UuidVersion | undefined) ?? 'v4';

function readCount(): number {
  const n = Number(countInput.value);
  return n;
}

function formatOptions() {
  return {
    uppercase: uppercase.checked,
    removeHyphens: hyphens.checked,
    quotes: quotes.checked,
    format: formatSelect.value as OutputFormat,
  };
}

function render(): void {
  if (batch.length === 0) {
    output.value = '';
    outputStats.textContent = '';
    return;
  }
  output.value = formatUuids(batch, formatOptions());
  outputStats.textContent = `${batch.length.toLocaleString()} UUID${batch.length === 1 ? '' : 's'} · ${output.value.length.toLocaleString()} chars`;
}

function generateBatch(): void {
  const count = readCount();
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    countInput.setAttribute('aria-invalid', 'true');
    setStatus(
      status,
      `Count must be a whole number between ${MIN_COUNT} and ${MAX_COUNT}.`,
      'error',
    );
    return;
  }
  countInput.removeAttribute('aria-invalid');
  try {
    const v = version();
    batch = generateUuids(v, count);
    render();
    const label = v === 'nil' || v === 'max' ? `${v} UUID` : `${v} UUID${count === 1 ? '' : 's'}`;
    setStatus(status, `Generated ${count.toLocaleString()} ${label} locally.`, 'success');
  } catch (err) {
    batch = [];
    render();
    setStatus(status, err instanceof Error ? err.message : 'Could not generate.', 'error');
  }
}

function inspect(): void {
  const raw = inspectInput.value;
  if (raw.trim() === '') {
    details.hidden = true;
    inspectInput.removeAttribute('aria-invalid');
    setStatus(inspectStatus, '');
    return;
  }
  try {
    const parsed = parseUuid(raw);
    detailUuid.textContent = parsed.uuid;
    detailVersion.textContent =
      parsed.version === 0 ? parsed.versionLabel : `${parsed.version} — ${parsed.versionLabel}`;
    detailVariant.textContent = parsed.variant;
    if (parsed.timestamp) {
      timestampRow.hidden = false;
      detailTimestamp.textContent = `${parsed.timestamp.toISOString()} (${parsed.timestamp.toLocaleString()})`;
    } else {
      timestampRow.hidden = true;
      detailTimestamp.textContent = '';
    }
    details.hidden = false;
    inspectInput.removeAttribute('aria-invalid');
    setStatus(inspectStatus, parsed.summary, 'success');
  } catch (err) {
    details.hidden = true;
    inspectInput.setAttribute('aria-invalid', 'true');
    setStatus(inspectStatus, err instanceof Error ? err.message : 'Not a UUID.', 'error');
  }
}

// --- events -----------------------------------------------------------------

for (const r of versionInputs) r.addEventListener('change', generateBatch);
countInput.addEventListener('input', debounce(generateBatch, 200));
formatSelect.addEventListener('change', render);
for (const opt of [uppercase, hyphens, quotes]) opt.addEventListener('change', render);
inspectInput.addEventListener('input', debounce(inspect, 80));

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'generate':
      generateBatch();
      break;

    case 'clear':
      batch = [];
      render();
      setStatus(status, '');
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
      if (output.value) {
        const ext =
          formatSelect.value === 'json' ? 'json' : formatSelect.value === 'ts' ? 'ts' : 'txt';
        downloadText(output.value, `uuids-${version()}.${ext}`);
      }
      break;

    case 'inspect-last':
      if (batch[0]) {
        inspectInput.value = batch[0];
        inspect();
        inspectInput.focus();
      } else {
        setStatus(inspectStatus, 'Generate a UUID first, then inspect it here.', 'info');
      }
      break;

    case 'inspect-clear':
      inspectInput.value = '';
      inspect();
      inspectInput.focus();
      break;
  }
});

generateBatch();
