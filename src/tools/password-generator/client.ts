import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  type PassphraseOptions,
  type PasswordOptions,
  type Separator,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
  strengthFor,
} from './logic';

type Mode = 'random' | 'passphrase';

const PRIVACY_NOTE =
  'Generated on your device with crypto.getRandomValues — nothing is stored or transmitted.';
const MANY = 10;

const SEPARATORS: Record<string, Separator> = {
  hyphen: '-',
  dot: '.',
  space: ' ',
  underscore: '_',
  custom: 'custom',
};

const root = $<HTMLElement>('[data-tool="password-generator"]');
const output = $<HTMLTextAreaElement>('[data-output]', root);
const outputLabel = $('[data-output-label]', root);
const status = $('[data-status]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);
const panels = $$<HTMLElement>('[data-panel]', root);

const lengthInput = $<HTMLInputElement>('[data-opt="length"]', root);
const lengthRange = $<HTMLInputElement>('[data-opt="length-range"]', root);
const lowercase = $<HTMLInputElement>('[data-opt="lowercase"]', root);
const uppercase = $<HTMLInputElement>('[data-opt="uppercase"]', root);
const digits = $<HTMLInputElement>('[data-opt="digits"]', root);
const symbols = $<HTMLInputElement>('[data-opt="symbols"]', root);
const symbolSet = $<HTMLInputElement>('[data-opt="symbol-set"]', root);
const symbolsWrap = $<HTMLElement>('[data-symbols-wrap]', root);
const ambiguous = $<HTMLInputElement>('[data-opt="ambiguous"]', root);
const requireEach = $<HTMLInputElement>('[data-opt="require-each"]', root);

const wordsInput = $<HTMLInputElement>('[data-opt="words"]', root);
const separatorSelect = $<HTMLSelectElement>('[data-opt="separator"]', root);
const customSeparator = $<HTMLInputElement>('[data-opt="custom-separator"]', root);
const customSeparatorWrap = $<HTMLElement>('[data-custom-separator-wrap]', root);
const capitalize = $<HTMLInputElement>('[data-opt="capitalize"]', root);
const appendNumber = $<HTMLInputElement>('[data-opt="append-number"]', root);

const meter = $<HTMLElement>('[data-meter]', root);
const meterBar = $<HTMLElement>('[data-meter-bar]', root);
const strengthText = $('[data-strength]', root);

const LEVEL_CLASSES = [0, 1, 2, 3, 4].map((n) => `tool-password-generator__meter-bar--level-${n}`);

const mode = (): Mode => (modeInputs.find((r) => r.checked)?.value as Mode | undefined) ?? 'random';

function passwordOptions(): PasswordOptions {
  return {
    length: Number(lengthInput.value),
    lowercase: lowercase.checked,
    uppercase: uppercase.checked,
    digits: digits.checked,
    symbols: symbols.checked,
    symbolSet: symbolSet.value,
    excludeAmbiguous: ambiguous.checked,
    requireEach: requireEach.checked,
  };
}

function passphraseOptions(): PassphraseOptions {
  return {
    words: Number(wordsInput.value),
    separator: SEPARATORS[separatorSelect.value] ?? '-',
    customSeparator: customSeparator.value,
    capitalize: capitalize.checked,
    appendNumber: appendNumber.checked,
  };
}

function updatePanels(): void {
  const current = mode();
  for (const panel of panels) panel.hidden = panel.dataset.panel !== current;
  symbolsWrap.hidden = !symbols.checked;
  customSeparatorWrap.hidden = separatorSelect.value !== 'custom';
}

function renderStrength(bits: number): void {
  const strength = strengthFor(bits);
  meterBar.classList.remove(...LEVEL_CLASSES);
  meterBar.classList.add(LEVEL_CLASSES[strength.level] as string);
  meter.setAttribute('aria-valuenow', String(strength.level));
  if (strength.level === 0) {
    meter.setAttribute('aria-valuetext', 'Nothing generated');
    strengthText.textContent = '';
    return;
  }
  const text = `${strength.label} · ≈ ${Math.round(strength.bits)} bits of entropy`;
  meter.setAttribute('aria-valuetext', text);
  strengthText.textContent = text;
}

function markInvalid(el: HTMLInputElement, invalid: boolean): void {
  if (invalid) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

/** Validate the numeric inputs up front so the error names the right control. */
function validateInputs(): string | null {
  if (mode() === 'random') {
    const n = Number(lengthInput.value);
    const bad = !Number.isInteger(n) || n < MIN_LENGTH || n > MAX_LENGTH;
    markInvalid(lengthInput, bad);
    if (bad) return `Length must be a whole number between ${MIN_LENGTH} and ${MAX_LENGTH}.`;
    return null;
  }
  const n = Number(wordsInput.value);
  const bad = !Number.isInteger(n) || n < MIN_WORDS || n > MAX_WORDS;
  markInvalid(wordsInput, bad);
  if (bad) return `Word count must be a whole number between ${MIN_WORDS} and ${MAX_WORDS}.`;
  return null;
}

function generate(count: number): void {
  const problem = validateInputs();
  if (problem) {
    output.value = '';
    renderStrength(0);
    setStatus(status, problem, 'error');
    return;
  }
  try {
    const current = mode();
    const values: string[] = [];
    let bits: number;
    if (current === 'random') {
      const opts = passwordOptions();
      for (let i = 0; i < count; i++) values.push(generatePassword(opts));
      bits = passwordEntropy(opts);
    } else {
      const opts = passphraseOptions();
      for (let i = 0; i < count; i++) values.push(generatePassphrase(opts));
      bits = passphraseEntropy(opts);
    }
    output.value = values.join('\n');
    output.rows = Math.min(count, MANY) + 1;
    const noun = current === 'random' ? 'password' : 'passphrase';
    outputLabel.textContent = count === 1 ? `Generated ${noun}` : `Generated ${noun}s`;
    renderStrength(bits);
    setStatus(status, PRIVACY_NOTE, 'success');
  } catch (err) {
    output.value = '';
    renderStrength(0);
    setStatus(status, err instanceof Error ? err.message : 'Could not generate.', 'error');
  }
}

const generateOne = (): void => generate(1);
const generateDebounced = debounce(generateOne, 150);

// --- events -----------------------------------------------------------------

for (const r of modeInputs) {
  r.addEventListener('change', () => {
    updatePanels();
    generateOne();
  });
}

lengthInput.addEventListener('input', () => {
  lengthRange.value = lengthInput.value;
  generateDebounced();
});
lengthRange.addEventListener('input', () => {
  lengthInput.value = lengthRange.value;
  generateOne();
});
wordsInput.addEventListener('input', generateDebounced);

for (const opt of [
  lowercase,
  uppercase,
  digits,
  ambiguous,
  requireEach,
  capitalize,
  appendNumber,
]) {
  opt.addEventListener('change', generateOne);
}
symbols.addEventListener('change', () => {
  updatePanels();
  generateOne();
});
symbolSet.addEventListener('input', generateDebounced);
separatorSelect.addEventListener('change', () => {
  updatePanels();
  generateOne();
  if (separatorSelect.value === 'custom') customSeparator.focus();
});
customSeparator.addEventListener('input', generateDebounced);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'generate':
      generateOne();
      break;

    case 'generate-many':
      generate(MANY);
      break;

    case 'clear':
      output.value = '';
      output.rows = 2;
      renderStrength(0);
      setStatus(status, '');
      break;

    case 'copy': {
      if (!output.value) return;
      const ok = await copyText(output.value);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the password and copy manually.',
          'error',
        );
      break;
    }
  }
});

updatePanels();
generateOne();
