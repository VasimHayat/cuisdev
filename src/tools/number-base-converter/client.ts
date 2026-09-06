import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  BaseError,
  type BitWidth,
  type FormatOptions,
  SAMPLE_DECIMAL,
  bitLength,
  convertAll,
  numberToWords,
  parseInBase,
  twosComplement,
} from './logic';

const EMPTY = '—';

const root = $<HTMLElement>('[data-tool="number-base-converter"]');
const status = $('[data-status]', root);
const uppercase = $<HTMLInputElement>('[data-opt="uppercase"]', root);
const group = $<HTMLInputElement>('[data-opt="group"]', root);
const customBase = $<HTMLSelectElement>('[data-custom-base]', root);
const widthSelect = $<HTMLSelectElement>('[data-width]', root);
const twosLabel = $('[data-twos-label]', root);
const fields = new Map<string, HTMLInputElement>(
  $$<HTMLInputElement>('[data-base]', root).map((el) => [el.dataset.base ?? '', el]),
);
const details = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-value]', root).map((el) => [el.dataset.value ?? '', el]),
);

/** The value every field currently represents, or null while input is invalid. */
let current: bigint | null = null;

const options = (): FormatOptions => ({ uppercase: uppercase.checked, group: group.checked });
const custom = (): number => Number(customBase.value);
const width = (): BitWidth => Number(widthSelect.value) as BitWidth;

function baseOf(id: string): number {
  return id === 'custom' ? custom() : Number(id);
}

function setDetail(id: string, value: string | null): void {
  const cell = details.get(id);
  if (cell) cell.textContent = value ?? EMPTY;
  const button = root.querySelector<HTMLButtonElement>(
    `[data-action="copy-detail"][data-detail="${id}"]`,
  );
  if (button) button.disabled = value === null;
}

function renderDetails(value: bigint | null): void {
  twosLabel.textContent = `Two’s complement (${width()}-bit)`;
  if (value === null) {
    setDetail('bits', null);
    setDetail('twos-binary', null);
    setDetail('twos-hex', null);
    setDetail('words', null);
    return;
  }
  const bits = bitLength(value);
  setDetail('bits', `${bits} ${bits === 1 ? 'bit' : 'bits'}`);
  try {
    const twos = twosComplement(value, width());
    setDetail('twos-binary', twos.binary);
    setDetail('twos-hex', twos.hex);
  } catch (err) {
    const message = err instanceof BaseError ? err.message : 'Does not fit.';
    const cell = details.get('twos-binary');
    if (cell) cell.textContent = message;
    setDetail('twos-hex', null);
  }
  try {
    setDetail('words', numberToWords(value));
  } catch {
    setDetail('words', null);
  }
}

/** Re-render every field except `except`, which the user is typing in. */
function render(value: bigint | null, except?: string): void {
  current = value;
  for (const button of $$<HTMLButtonElement>('[data-action="copy-base"]', root)) {
    button.disabled = value === null;
  }
  if (value === null) {
    for (const [id, field] of fields) if (id !== except) field.value = '';
    renderDetails(null);
    return;
  }
  for (const row of convertAll(value, options(), custom())) {
    const field = fields.get(row.id);
    if (field && row.id !== except) field.value = row.value;
  }
  renderDetails(value);
}

function markInvalid(except?: string): void {
  for (const [id, field] of fields) {
    if (id === except) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  for (const button of $$<HTMLButtonElement>('[data-action="copy-base"]', root)) {
    button.disabled = true;
  }
}

function clearInvalid(): void {
  for (const field of fields.values()) field.removeAttribute('aria-invalid');
}

function convertFrom(id: string): void {
  const field = fields.get(id);
  if (!field) return;
  if (field.value.trim() === '') {
    clearInvalid();
    render(null, id);
    setStatus(status, 'Enter a number in any of the fields.');
    return;
  }
  try {
    const value = parseInBase(field.value, baseOf(id));
    clearInvalid();
    render(value, id);
    setStatus(status, '');
  } catch (err) {
    markInvalid(id);
    render(null, id);
    setStatus(
      status,
      err instanceof BaseError ? err.message : 'Could not read that number.',
      'error',
    );
  }
}

// --- events -----------------------------------------------------------------

for (const [id, field] of fields) {
  field.addEventListener(
    'input',
    debounce(() => convertFrom(id), 80),
  );
}

for (const control of [uppercase, group]) {
  control.addEventListener('change', () => render(current));
}

// The custom field is re-rendered in the newly chosen base.
customBase.addEventListener('change', () => render(current));

widthSelect.addEventListener('change', () => renderDetails(current));

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample': {
      const decimal = fields.get('10');
      if (!decimal) return;
      decimal.value = SAMPLE_DECIMAL;
      convertFrom('10');
      decimal.focus();
      break;
    }

    case 'clear':
      for (const field of fields.values()) field.value = '';
      clearInvalid();
      render(null);
      setStatus(status, 'Enter a number in any of the fields.');
      fields.get('10')?.focus();
      break;

    case 'copy-base': {
      const field = fields.get(button.dataset.baseId ?? '');
      if (!field?.value) return;
      if (await copyText(field.value)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }

    case 'copy-detail': {
      const text = details.get(button.dataset.detail ?? '')?.textContent ?? '';
      if (text === '' || text === EMPTY) return;
      if (await copyText(text)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }
  }
});

convertFrom('10');
