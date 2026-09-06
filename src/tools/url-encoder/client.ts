import { $, $$, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';

import { type ParsedUrl, type UrlMode, decode, encode, parseUrl } from './logic';

type Mode = 'encode' | 'decode';

const SAMPLE = {
  encode: 'https://example.com/search?q=café au lait&lang=fr&page=2#results',
  decode: 'https://example.com/search?q=caf%C3%A9%20au%20lait&lang=fr&page=2#results',
};
const PLACEHOLDER = {
  encode: 'Type or paste text or a URL…',
  decode: 'Paste a percent-encoded URL or value…',
};

const root = $<HTMLElement>('[data-tool="url-encoder"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const style = $<HTMLSelectElement>('[data-opt="style"]', root);
const stable = $<HTMLInputElement>('[data-opt="stable"]', root);
const decodeOnly = $$('[data-decode-only]', root);
const breakdown = $('[data-breakdown]', root);
const breakdownBody = $<HTMLTableSectionElement>('[data-breakdown-body]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const encoder = new TextEncoder();

const mode = (): Mode => (modeInputs.find((r) => r.checked)?.value as Mode | undefined) ?? 'encode';
const urlMode = (): UrlMode => style.value as UrlMode;

function setMode(next: Mode): void {
  for (const r of modeInputs) r.checked = r.value === next;
  updateLabels();
}

function updateLabels(): void {
  const encoding = mode() === 'encode';
  inputLabel.textContent = encoding ? 'Text to encode' : 'URL-encoded text to decode';
  outputLabel.textContent = encoding ? 'URL-encoded' : 'Decoded text';
  input.placeholder = PLACEHOLDER[mode()];
  for (const el of decodeOnly) el.toggleAttribute('hidden', encoding);
}

function stats(el: HTMLElement, text: string): void {
  el.textContent =
    text.length === 0
      ? ''
      : `${text.length.toLocaleString()} chars · ${formatBytes(encoder.encode(text).length)}`;
}

function cell(tag: 'th' | 'td', text: string, mono = false): HTMLTableCellElement {
  const el = document.createElement(tag);
  if (tag === 'th') el.scope = 'row';
  el.textContent = text;
  if (mono) el.classList.add('tool-url-encoder__mono');
  return el;
}

function row(label: string, value: string, mono = true): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const td = cell('td', value, mono);
  td.colSpan = 2;
  tr.append(cell('th', label), td);
  return tr;
}

function renderBreakdown(parsed: ParsedUrl | null): void {
  breakdownBody.replaceChildren();
  if (!parsed) {
    breakdown.hidden = true;
    return;
  }
  const rows: HTMLTableRowElement[] = [row('Protocol', parsed.protocol)];
  if (parsed.username) rows.push(row('Username', parsed.username));
  if (parsed.password) rows.push(row('Password', parsed.password));
  rows.push(row('Host', parsed.host));
  if (parsed.port) rows.push(row('Port', parsed.port));
  rows.push(row('Path', parsed.path || '/'));
  if (parsed.query.length === 0) {
    rows.push(row('Query', '(none)', false));
  } else {
    parsed.query.forEach((param, i) => {
      const tr = document.createElement('tr');
      tr.classList.add('tool-url-encoder__param');
      tr.append(
        cell('th', i === 0 ? 'Query' : ''),
        cell('td', param.key, true),
        cell('td', param.value, true),
      );
      rows.push(tr);
    });
  }
  if (parsed.hash) rows.push(row('Hash', parsed.hash));
  breakdownBody.append(...rows);
  breakdown.hidden = false;
}

function run(): void {
  const text = input.value;
  stats(inputStats, text);

  if (text.trim() === '') {
    output.value = '';
    outputStats.textContent = '';
    setStatus(status, '');
    renderBreakdown(null);
    return;
  }

  try {
    if (mode() === 'encode') {
      output.value = encode(text, urlMode());
      setStatus(status, '');
      renderBreakdown(parseUrl(text) ?? parseUrl(output.value));
    } else {
      const result = decode(text, { mode: urlMode(), untilStable: stable.checked });
      output.value = result.text;
      if (result.passes === 0) {
        setStatus(status, 'Nothing to decode — the input contains no percent-escapes.');
      } else if (stable.checked && result.passes > 1) {
        setStatus(status, `Decoded ${result.passes} layers of encoding.`, 'success');
      } else {
        setStatus(status, '');
      }
      renderBreakdown(parseUrl(result.text) ?? parseUrl(text));
    }
    stats(outputStats, output.value);
  } catch (err) {
    output.value = '';
    outputStats.textContent = '';
    renderBreakdown(null);
    setStatus(status, err instanceof Error ? err.message : 'Could not process the input.', 'error');
  }
}

const runDebounced = debounce(run, 60);

// --- events -----------------------------------------------------------------

input.addEventListener('input', runDebounced);
for (const r of modeInputs) {
  r.addEventListener('change', () => {
    updateLabels();
    run();
  });
}
style.addEventListener('change', run);
stable.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.value = SAMPLE[mode()];
      if (mode() === 'encode' && urlMode() === 'component') style.value = 'full';
      run();
      input.focus();
      break;

    case 'clear':
      input.value = '';
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

    case 'swap': {
      if (!output.value) return;
      input.value = output.value;
      setMode(mode() === 'encode' ? 'decode' : 'encode');
      run();
      break;
    }
  }
});

updateLabels();
run();
