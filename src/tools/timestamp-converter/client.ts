import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  SAMPLE_TIMESTAMP,
  TimestampError,
  type UnitChoice,
  describeDate,
  describeTimestamp,
  msToZonedInput,
  parseDateText,
  parseTimestamp,
  toIsoWithOffset,
  unixSeconds,
  zonedInputToMs,
} from './logic';

const EMPTY = '—';

const TIMESTAMP_ROWS = [
  'iso',
  'iso-offset',
  'rfc',
  'local',
  'relative',
  'weekday',
  'day-of-year',
  'iso-week',
  'seconds',
  'milliseconds',
];
const DATE_ROWS = ['to-seconds', 'to-milliseconds'];

const root = $<HTMLElement>('[data-tool="timestamp-converter"]');
const input = $<HTMLInputElement>('[data-input]', root);
const unitSelect = $<HTMLSelectElement>('[data-unit]', root);
const zoneSelect = $<HTMLSelectElement>('[data-timezone]', root);
const detected = $('[data-detected]', root);
const datetime = $<HTMLInputElement>('[data-datetime]', root);
const dateText = $<HTMLInputElement>('[data-date-text]', root);
const nowIso = $('[data-now-iso]', root);
const nowSeconds = $('[data-now-seconds]', root);
const status = $('[data-status]', root);
const valueCells = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-value]', root).map((el) => [el.dataset.value ?? '', el]),
);

/** Values currently shown, keyed by row id, for the per-row Copy buttons. */
const current = new Map<string, string>();

const zone = (): string => zoneSelect.value;

function setRow(id: string, value: string | null): void {
  const cell = valueCells.get(id);
  if (cell) cell.textContent = value ?? EMPTY;
  if (value === null) current.delete(id);
  else current.set(id, value);
  const button = root.querySelector<HTMLButtonElement>(
    `[data-action="copy-row"][data-format="${id}"]`,
  );
  if (button) button.disabled = value === null;
}

function clearRows(ids: string[]): void {
  for (const id of ids) setRow(id, null);
}

function runTimestamp(): void {
  if (input.value.trim() === '') {
    input.removeAttribute('aria-invalid');
    clearRows(TIMESTAMP_ROWS);
    detected.textContent = '';
    setStatus(status, 'Enter a Unix timestamp, or pick a date on the right.');
    return;
  }
  try {
    const parsed = parseTimestamp(input.value, unitSelect.value as UnitChoice);
    input.removeAttribute('aria-invalid');
    for (const row of describeTimestamp(parsed.ms, { timeZone: zone(), now: new Date() })) {
      setRow(row.id, row.value);
    }
    detected.textContent = parsed.detected
      ? `Detected as ${parsed.unit}.`
      : `Read as ${parsed.unit}.`;
    setStatus(status, '');
  } catch (err) {
    input.setAttribute('aria-invalid', 'true');
    clearRows(TIMESTAMP_ROWS);
    detected.textContent = '';
    setStatus(
      status,
      err instanceof TimestampError ? err.message : 'Could not read that timestamp.',
      'error',
    );
  }
}

function runDate(source: 'picker' | 'text'): void {
  try {
    const ms =
      source === 'text' && dateText.value.trim() !== ''
        ? parseDateText(dateText.value)
        : zonedInputToMs(datetime.value, zone());
    dateText.removeAttribute('aria-invalid');
    datetime.removeAttribute('aria-invalid');
    for (const row of describeDate(ms)) setRow(row.id, row.value);
    if (source === 'text') datetime.value = msToZonedInput(ms, zone());
    setStatus(status, '');
  } catch (err) {
    if (source === 'text') dateText.setAttribute('aria-invalid', 'true');
    else datetime.setAttribute('aria-invalid', 'true');
    clearRows(DATE_ROWS);
    setStatus(
      status,
      err instanceof TimestampError ? err.message : 'Could not read that date.',
      'error',
    );
  }
}

function tick(): void {
  const now = Date.now();
  nowIso.textContent = toIsoWithOffset(now, zone());
  nowSeconds.textContent = `${unixSeconds(now)} s`;
}

// --- events -----------------------------------------------------------------

const runTimestampDebounced = debounce(runTimestamp, 80);
const runDateTextDebounced = debounce(() => runDate('text'), 120);

input.addEventListener('input', runTimestampDebounced);
unitSelect.addEventListener('change', runTimestamp);
datetime.addEventListener('input', () => runDate('picker'));
dateText.addEventListener('input', runDateTextDebounced);
zoneSelect.addEventListener('change', () => {
  runTimestamp();
  runDate('picker');
  tick();
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.value = SAMPLE_TIMESTAMP;
      unitSelect.value = 'auto';
      runTimestamp();
      input.focus();
      break;

    case 'clear':
      input.value = '';
      dateText.value = '';
      runTimestamp();
      clearRows(DATE_ROWS);
      input.focus();
      break;

    case 'use-now': {
      const now = Date.now();
      input.value = String(unixSeconds(now));
      unitSelect.value = 'auto';
      datetime.value = msToZonedInput(now, zone());
      runTimestamp();
      runDate('picker');
      break;
    }

    case 'copy-now': {
      const text = String(unixSeconds(Date.now()));
      if (await copyText(text)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }

    case 'copy-row': {
      const value = current.get(button.dataset.format ?? '');
      if (!value) return;
      if (await copyText(value)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }
  }
});

// Label the "Local time" option with the zone the browser resolved.
const localOption = zoneSelect.querySelector<HTMLOptionElement>('option[value="local"]');
if (localOption) {
  try {
    localOption.textContent = `Local time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
  } catch {
    /* keep the plain label */
  }
}

runTimestamp();
runDate('picker');
tick();
window.setInterval(tick, 1000);
