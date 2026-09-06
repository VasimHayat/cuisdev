import QRCode from 'qrcode';

import {
  $,
  $$,
  copyText,
  debounce,
  downloadBlob,
  downloadText,
  flashButton,
  setStatus,
} from '@/lib/dom';

import {
  ERROR_CORRECTION_LEVELS,
  type ErrorCorrectionLevel,
  PRESET_LABELS,
  type PresetFields,
  QR_PRESETS,
  QrError,
  type QrPreset,
  type QrRenderOptions,
  SAMPLES,
  type WifiEncryption,
  analyzeQr,
  buildPayload,
  describeQrError,
  toLibraryOptions,
  toSvg,
  validateRenderOptions,
} from './logic';

type OutputFormat = 'png' | 'svg';

const root = $<HTMLElement>('[data-tool="qr-code-generator"]');
const presetSelect = $<HTMLSelectElement>('[data-opt="preset"]', root);
const formatInputs = $$<HTMLInputElement>('[data-output-format] input', root);
const forms = $$<HTMLElement>('[data-form]', root);
const inputTitle = $('[data-input-title]', root);
const payloadWrap = $('[data-payload-wrap]', root);
const payloadOut = $<HTMLTextAreaElement>('[data-payload]', root);
const canvas = $<HTMLCanvasElement>('[data-canvas]', root);
const svgHost = $('[data-svg]', root);
const placeholder = $('[data-placeholder]', root);
const stats = $('[data-stats]', root);
const status = $('[data-status]', root);
const sizeInput = $<HTMLInputElement>('[data-opt="size"]', root);
const ecSelect = $<HTMLSelectElement>('[data-opt="ec"]', root);
const marginInput = $<HTMLInputElement>('[data-opt="margin"]', root);
const fgInput = $<HTMLInputElement>('[data-opt="fg"]', root);
const bgInput = $<HTMLInputElement>('[data-opt="bg"]', root);
const optionInputs = [sizeInput, marginInput, fgInput, bgInput];
const outputButtons = $$<HTMLButtonElement>(
  '[data-action="copy"], [data-action="download-png"], [data-action="download-svg"]',
  root,
);

/** Payload + options behind the code currently on screen; null when nothing is rendered. */
let current: { payload: string; options: QrRenderOptions } | null = null;
/** Monotonic id so a slow render never overwrites a newer one. */
let renderId = 0;

// --- state readers ---------------------------------------------------------------

function preset(): QrPreset {
  const value = presetSelect.value as QrPreset;
  return QR_PRESETS.includes(value) ? value : 'text';
}

function outputFormat(): OutputFormat {
  return formatInputs.find((r) => r.checked)?.value === 'svg' ? 'svg' : 'png';
}

function activeForm(): HTMLElement {
  return forms.find((f) => f.dataset.form === preset()) ?? (forms[0] as HTMLElement);
}

function fieldElements(form: HTMLElement) {
  return $$<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field]', form);
}

function readFields(): PresetFields {
  const fields: PresetFields = {};
  for (const el of fieldElements(activeForm())) {
    const key = el.dataset.field as keyof PresetFields;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (key === 'hidden') fields.hidden = el.checked;
    } else if (key === 'encryption') {
      fields.encryption = el.value as WifiEncryption;
    } else if (key !== 'hidden') {
      fields[key] = el.value;
    }
  }
  return fields;
}

/** The one field a preset cannot do without — blank means "nothing to encode yet". */
function primaryValue(fields: PresetFields): string {
  switch (preset()) {
    case 'wifi':
      return fields.ssid ?? '';
    case 'email':
      return fields.to ?? '';
    case 'phone':
    case 'sms':
      return fields.phone ?? '';
    case 'vcard':
      return fields.name ?? '';
    default:
      return fields.text ?? '';
  }
}

function readNumber(input: HTMLInputElement): number {
  const raw = input.value.trim();
  return raw === '' ? Number.NaN : Number(raw);
}

function readOptions(): QrRenderOptions {
  const ec = ecSelect.value as ErrorCorrectionLevel;
  return validateRenderOptions({
    size: readNumber(sizeInput),
    errorCorrection: ERROR_CORRECTION_LEVELS.includes(ec) ? ec : 'M',
    margin: readNumber(marginInput),
    foreground: fgInput.value,
    background: bgInput.value,
  });
}

// --- rendering -------------------------------------------------------------------

function showPreview(kind: OutputFormat | null): void {
  canvas.hidden = kind !== 'png';
  svgHost.hidden = kind !== 'svg';
  placeholder.hidden = kind !== null;
  for (const b of outputButtons) b.disabled = kind === null;
}

function clearPreview(): void {
  current = null;
  svgHost.replaceChildren();
  stats.textContent = '';
  showPreview(null);
}

async function renderCanvas(
  target: HTMLCanvasElement,
  payload: string,
  options: QrRenderOptions,
): Promise<void> {
  await QRCode.toCanvas(target, payload, toLibraryOptions(options));
  // The library sizes the element via CSSOM; our CSS scales it from the width/height attributes.
  target.removeAttribute('style');
}

async function renderSvg(payload: string, options: QrRenderOptions): Promise<void> {
  const markup = await toSvg(payload, options);
  // Library-generated markup: the payload only influences path geometry, never text.
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  svg.setAttribute('class', 'tool-qr-code-generator__image');
  svgHost.replaceChildren(svg);
}

function updatePresetUi(): void {
  const active = preset();
  for (const form of forms) form.hidden = form.dataset.form !== active;
  inputTitle.textContent = PRESET_LABELS[active];
  payloadWrap.hidden = active === 'text';
}

async function run(): Promise<void> {
  const id = ++renderId;
  let payload = '';
  let fields: PresetFields;

  try {
    fields = readFields();
    if (primaryValue(fields).trim() === '') {
      clearPreview();
      payloadOut.value = '';
      setStatus(status, '');
      return;
    }
    payload = buildPayload(preset(), fields);
    payloadOut.value = preset() === 'text' ? '' : payload;
    const options = readOptions();
    const info = analyzeQr(payload, options.errorCorrection);
    const format = outputFormat();

    if (format === 'svg') await renderSvg(payload, options);
    else await renderCanvas(canvas, payload, options);
    if (id !== renderId) return;

    current = { payload, options };
    showPreview(format);
    stats.textContent =
      `${info.characters.toLocaleString()} chars · ${info.bytes.toLocaleString()} bytes · ` +
      `version ${info.version} · ${info.modules}×${info.modules} modules · ` +
      `${options.size}×${options.size} px`;
    setStatus(status, '');
  } catch (err) {
    if (id !== renderId) return;
    clearPreview();
    const friendly = describeQrError(err, payload, ecSelect.value as ErrorCorrectionLevel);
    setStatus(status, friendly.message, 'error');
  }
}

const runDebounced = debounce(() => void run(), 80);

// --- actions ---------------------------------------------------------------------

function loadSample(): void {
  const sample = SAMPLES[preset()];
  for (const el of fieldElements(activeForm())) {
    const key = el.dataset.field as keyof PresetFields;
    const value = sample[key];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = value === true;
    else el.value = typeof value === 'string' ? value : '';
  }
}

function clearFields(): void {
  for (const el of fieldElements(activeForm())) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = false;
    else if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
    else el.value = '';
  }
}

function canvasToBlob(source: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    source.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new QrError('Could not export the canvas as PNG.'));
    }, 'image/png');
  });
}

async function pngBlob(): Promise<Blob> {
  if (!current) throw new QrError('Nothing to export yet.');
  if (!canvas.hidden) return canvasToBlob(canvas);
  const offscreen = document.createElement('canvas');
  await renderCanvas(offscreen, current.payload, current.options);
  return canvasToBlob(offscreen);
}

async function copyCurrent(): Promise<boolean> {
  if (!current) return false;
  if (outputFormat() === 'svg') return copyText(await toSvg(current.payload, current.options));
  try {
    const blob = await pngBlob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

function downloadName(extension: string): string {
  return `qr-${preset()}.${extension}`;
}

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      loadSample();
      await run();
      break;

    case 'clear':
      clearFields();
      await run();
      fieldElements(activeForm())[0]?.focus();
      break;

    case 'copy': {
      if (!current) return;
      if (await copyCurrent()) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — use Download to save the image instead.',
          'error',
        );
      break;
    }

    case 'download-png': {
      if (!current) return;
      try {
        downloadBlob(await pngBlob(), downloadName('png'));
      } catch (err) {
        setStatus(status, err instanceof Error ? err.message : 'Download failed.', 'error');
      }
      break;
    }

    case 'download-svg': {
      if (!current) return;
      downloadText(
        await toSvg(current.payload, current.options),
        downloadName('svg'),
        'image/svg+xml',
      );
      break;
    }
  }
});

// --- events ----------------------------------------------------------------------

presetSelect.addEventListener('change', () => {
  updatePresetUi();
  void run();
});
for (const r of formatInputs) r.addEventListener('change', () => void run());
ecSelect.addEventListener('change', () => void run());
for (const el of optionInputs) el.addEventListener('input', runDebounced);
for (const form of forms) {
  form.addEventListener('input', runDebounced);
  form.addEventListener('change', runDebounced);
}

updatePresetUi();
void run();
