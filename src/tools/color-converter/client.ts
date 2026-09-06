import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  type ColorRow,
  ColorError,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
  SAMPLE_COLOR,
  type Shade,
  contrastReport,
  convertAll,
  formatHexString,
  formatRatio,
  formatRgbaString,
  isOutOfGamut,
  parseColor,
  shadesAndTints,
} from './logic';

const SAMPLES = [
  '#3b82f6',
  'oklch(0.72 0.19 45)',
  'hsl(160 84% 39%)',
  'rebeccapurple',
  '#ff634780',
];
const EMPTY = '—';

const root = $<HTMLElement>('[data-tool="color-converter"]');
const input = $<HTMLInputElement>('[data-input]', root);
const picker = $<HTMLInputElement>('[data-picker]', root);
const preview = $<HTMLCanvasElement>('[data-preview]', root);
const gamut = $('[data-gamut]', root);
const status = $('[data-status]', root);
const scaleList = $('[data-scale]', root);
const swatches = $$<HTMLLIElement>('[data-shade]', scaleList);
const valueCells = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-value]', root).map((el) => [el.dataset.value ?? '', el]),
);

const fgInput = $<HTMLInputElement>('[data-fg]', root);
const bgInput = $<HTMLInputElement>('[data-bg]', root);
const fgPicker = $<HTMLInputElement>('[data-fg-picker]', root);
const bgPicker = $<HTMLInputElement>('[data-bg-picker]', root);
const contrastPreview = $<HTMLCanvasElement>('[data-contrast-preview]', root);
const ratioOut = $<HTMLElement>('[data-ratio]', root);
const badges = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-level]', root).map((el) => [el.dataset.level ?? '', el]),
);

let currentRows: ColorRow[] = [];
let currentScale: Shade[] = [];
let sampleIndex = 0;

// --- canvas painting (CSP forbids inline styles, so colours are drawn) -------

function checkerboard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const size = 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#d4d4d8';
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if (((x / size) | 0) % 2 === ((y / size) | 0) % 2) ctx.fillRect(x, y, size, size);
    }
  }
}

function paint(canvas: HTMLCanvasElement, css: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  checkerboard(ctx, width, height);
  if (css === null) return;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, width, height);
}

function paintContrast(fgCss: string, bgCss: string): void {
  const ctx = contrastPreview.getContext('2d');
  if (!ctx) return;
  const { width, height } = contrastPreview;
  ctx.fillStyle = bgCss;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fgCss;
  ctx.textBaseline = 'middle';
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillText('Large text 24px bold', 20, 38);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Normal text — the quick brown fox jumps over the lazy dog.', 20, 86);
}

// --- rendering --------------------------------------------------------------

function renderRows(rows: ColorRow[] | null): void {
  currentRows = rows ?? [];
  for (const [id, cell] of valueCells) {
    const row = rows?.find((r) => r.id === id);
    cell.textContent = row?.value ?? EMPTY;
    cell.dataset.state = row ? 'ready' : 'empty';
  }
  for (const button of $$<HTMLButtonElement>('[data-action="copy-row"]', root)) {
    button.disabled = rows === null;
  }
}

function renderScale(scale: Shade[] | null): void {
  currentScale = scale ?? [];
  swatches.forEach((item, index) => {
    const step = scale?.[index];
    const canvas = item.querySelector<HTMLCanvasElement>('[data-shade-canvas]');
    const hex = item.querySelector<HTMLElement>('[data-shade-hex]');
    const button = item.querySelector<HTMLButtonElement>('[data-action="copy-shade"]');
    if (hex) hex.textContent = step?.hex ?? EMPTY;
    if (canvas) {
      paint(canvas, step ? step.hex : null);
      canvas.setAttribute(
        'aria-label',
        step ? `${step.name}, ${step.hex}` : 'No color to preview yet',
      );
    }
    if (button) button.disabled = !step;
  });
}

function run(): void {
  const raw = input.value.trim();
  if (raw === '') {
    input.removeAttribute('aria-invalid');
    renderRows(null);
    renderScale(null);
    paint(preview, null);
    preview.setAttribute('aria-label', 'No color to preview yet');
    gamut.textContent = '';
    setStatus(status, 'Enter a color — for example #3b82f6, rgb(59 130 246) or tomato.');
    return;
  }

  try {
    const color = parseColor(raw);
    const css = formatRgbaString(color);
    const hex = formatHexString(color);
    input.removeAttribute('aria-invalid');
    renderRows(convertAll(color));
    renderScale(shadesAndTints(color));
    paint(preview, css);
    preview.setAttribute('aria-label', `Preview of ${hex}`);
    picker.value = hex;
    gamut.textContent = isOutOfGamut(color)
      ? 'Outside the sRGB gamut — hex and RGB values are clamped.'
      : '';
    setStatus(status, '');
  } catch (err) {
    input.setAttribute('aria-invalid', 'true');
    renderRows(null);
    renderScale(null);
    paint(preview, null);
    preview.setAttribute('aria-label', 'No color to preview yet');
    gamut.textContent = '';
    setStatus(
      status,
      err instanceof ColorError ? err.message : 'Could not read that color.',
      'error',
    );
  }
}

function runContrast(): void {
  let fg;
  let bg;
  try {
    fg = parseColor(fgInput.value);
    fgInput.removeAttribute('aria-invalid');
  } catch {
    fgInput.setAttribute('aria-invalid', 'true');
  }
  try {
    bg = parseColor(bgInput.value);
    bgInput.removeAttribute('aria-invalid');
  } catch {
    bgInput.setAttribute('aria-invalid', 'true');
  }

  if (!fg || !bg) {
    ratioOut.textContent = EMPTY;
    for (const badge of badges.values()) {
      badge.dataset.pass = 'unknown';
      const verdict = badge.querySelector('[data-verdict]');
      if (verdict) verdict.textContent = EMPTY;
    }
    return;
  }

  fgPicker.value = formatHexString(fg);
  bgPicker.value = formatHexString(bg);
  paintContrast(formatRgbaString(fg), formatRgbaString(bg));

  const report = contrastReport(fg, bg);
  ratioOut.textContent = formatRatio(report.ratio);
  const results: Record<string, boolean> = {
    'aa-normal': report.aaNormal,
    'aa-large': report.aaLarge,
    'aaa-normal': report.aaaNormal,
    'aaa-large': report.aaaLarge,
  };
  for (const [id, badge] of badges) {
    const pass = results[id] ?? false;
    badge.dataset.pass = String(pass);
    const verdict = badge.querySelector('[data-verdict]');
    if (verdict) verdict.textContent = pass ? 'Pass' : 'Fail';
  }
}

// --- events -----------------------------------------------------------------

const runDebounced = debounce(run, 60);
const runContrastDebounced = debounce(runContrast, 60);

input.addEventListener('input', runDebounced);
picker.addEventListener('input', () => {
  input.value = picker.value;
  run();
});

for (const el of [fgInput, bgInput]) el.addEventListener('input', runContrastDebounced);
fgPicker.addEventListener('input', () => {
  fgInput.value = fgPicker.value;
  runContrast();
});
bgPicker.addEventListener('input', () => {
  bgInput.value = bgPicker.value;
  runContrast();
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      sampleIndex = (sampleIndex + 1) % SAMPLES.length;
      input.value = SAMPLES[sampleIndex] ?? SAMPLE_COLOR;
      run();
      input.focus();
      break;

    case 'clear':
      input.value = '';
      run();
      input.focus();
      break;

    case 'copy-row': {
      const value = currentRows.find((r) => r.id === button.dataset.format)?.value;
      if (!value) return;
      if (await copyText(value)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }

    case 'copy-shade': {
      const index = swatches.indexOf(button.closest('li') as HTMLLIElement);
      const hex = currentScale[index]?.hex;
      if (!hex) return;
      if (await copyText(hex)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the value manually.', 'error');
      break;
    }

    case 'swap-contrast': {
      const fg = fgInput.value;
      fgInput.value = bgInput.value;
      bgInput.value = fg;
      runContrast();
      break;
    }
  }
});

if (input.value.trim() === '') input.value = SAMPLE_COLOR;
if (fgInput.value.trim() === '') fgInput.value = DEFAULT_TEXT_COLOR;
if (bgInput.value.trim() === '') bgInput.value = DEFAULT_BACKGROUND_COLOR;
run();
runContrast();
