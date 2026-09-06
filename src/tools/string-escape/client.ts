import { $, $$, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';

import { type EscapeTarget, StringEscapeError, escape, getTarget, unescape } from './logic';

type Mode = 'escape' | 'unescape';

/** Realistic plain-text samples per target; the unescape sample is the escaped form. */
const SAMPLES: Readonly<Record<EscapeTarget, string>> = {
  json: 'She said "it\'s in C:\\temp"\n\tTab-indented — ✓ done',
  javascript: 'It\'s a "quoted" `template` string\nwith a new line and a tab\t— ✓',
  'html-attribute': 'Tom & Jerry <b>"quoted"</b> and \'apostrophes\'',
  xml: '<note to="all">Fish & chips, \'cheap\' & "good"</note>',
  csv: 'Smith, John "JJ"\nSecond line',
  shell: "it's a file with spaces & $VARS `and` backticks.txt",
  regex: 'price: $5.99 (approx) [USD] a+b*c?',
  sql: 'O\'Reilly\'s "Learning SQL" — 3rd ed.',
};

const root = $<HTMLElement>('[data-tool="string-escape"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const hint = $('[data-hint]', root);
const targetSelect = $<HTMLSelectElement>('[data-opt="target"]', root);
const unescapeRadio = $<HTMLInputElement>('[data-unescape-radio]', root);
const swapButton = $<HTMLButtonElement>('[data-action="swap"]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const encoder = new TextEncoder();

const mode = (): Mode => (modeInputs.find((r) => r.checked)?.value as Mode | undefined) ?? 'escape';
const target = (): EscapeTarget => targetSelect.value as EscapeTarget;

function setMode(next: Mode): void {
  for (const r of modeInputs) r.checked = r.value === next;
}

/** Reflect the target's capabilities: one-way targets disable Unescape and Swap. */
function updateControls(): void {
  const info = getTarget(target());
  if (!info.canUnescape && mode() === 'unescape') setMode('escape');
  unescapeRadio.disabled = !info.canUnescape;
  unescapeRadio.closest('label')?.toggleAttribute('aria-disabled', !info.canUnescape);
  swapButton.disabled = !info.canUnescape;
  hint.textContent = info.canUnescape
    ? info.hint
    : `${info.hint} Unescape is unavailable for this target.`;

  const escaping = mode() === 'escape';
  inputLabel.textContent = escaping ? 'Text to escape' : `Escaped ${info.label} to unescape`;
  outputLabel.textContent = escaping ? 'Escaped' : 'Unescaped';
  input.placeholder = escaping ? 'Type or paste text…' : `Paste an escaped ${info.label}…`;
}

function stats(el: HTMLElement, text: string): void {
  el.textContent =
    text.length === 0
      ? ''
      : `${text.length.toLocaleString()} chars · ${formatBytes(encoder.encode(text).length)}`;
}

function run(): void {
  const text = input.value;
  stats(inputStats, text);

  if (text === '') {
    output.value = '';
    outputStats.textContent = '';
    setStatus(status, '');
    return;
  }

  try {
    output.value = mode() === 'escape' ? escape(text, target()) : unescape(text, target());
    stats(outputStats, output.value);
    if (mode() === 'unescape' && output.value === text) {
      setStatus(status, 'Nothing to unescape — the input contains no escape sequences.');
    } else {
      setStatus(status, '');
    }
  } catch (err) {
    output.value = '';
    outputStats.textContent = '';
    const message = err instanceof StringEscapeError ? err.message : 'Could not process the input.';
    setStatus(status, message, 'error');
  }
}

const runDebounced = debounce(run, 60);

// --- events -----------------------------------------------------------------

input.addEventListener('input', runDebounced);
for (const r of modeInputs) {
  r.addEventListener('change', () => {
    updateControls();
    run();
  });
}
targetSelect.addEventListener('change', () => {
  updateControls();
  run();
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample': {
      const plain = SAMPLES[target()];
      input.value = mode() === 'escape' ? plain : escape(plain, target());
      run();
      input.focus();
      break;
    }

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
      if (!output.value || !getTarget(target()).canUnescape) return;
      input.value = output.value;
      setMode(mode() === 'escape' ? 'unescape' : 'escape');
      updateControls();
      run();
      break;
    }
  }
});

updateControls();
run();
