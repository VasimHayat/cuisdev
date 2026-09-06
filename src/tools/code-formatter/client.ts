import {
  $,
  $$,
  copyText,
  debounce,
  downloadText,
  flashButton,
  formatBytes,
  setStatus,
} from '@/lib/dom';
import { type Editor, mountEditor } from '@/lib/editor';

import {
  beautify,
  type BeautifyOptions,
  byteLength,
  canMinify,
  CodeFormatError,
  fileNameFor,
  type IndentOption,
  isLanguageId,
  isReady,
  LANGUAGES,
  type LanguageId,
  minify,
  minifyUnavailableMessage,
  type Mode,
  type PrintWidth,
  SAMPLES,
  savingsPercent,
} from './logic';

const root = $<HTMLElement>('[data-tool="code-formatter"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);

const languageSelect = $<HTMLSelectElement>('[data-opt="language"]', root);
const indentSelect = $<HTMLSelectElement>('[data-opt="indent"]', root);
const widthSelect = $<HTMLSelectElement>('[data-opt="width"]', root);
const quotesOpt = $<HTMLInputElement>('[data-opt="quotes"]', root);
const semiOpt = $<HTMLInputElement>('[data-opt="semi"]', root);
const commasOpt = $<HTMLInputElement>('[data-opt="commas"]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const input: Editor = mountEditor(inputArea, { language: 'text', onChange: () => runDebounced() });
const output: Editor = mountEditor(outputArea, { language: 'text', readOnly: true });

/** Ignore results from a run the user has already superseded. */
let runId = 0;

const language = (): LanguageId =>
  isLanguageId(languageSelect.value) ? languageSelect.value : 'javascript';

const mode = (): Mode =>
  modeInputs.find((r) => r.checked)?.value === 'minify' ? 'minify' : 'beautify';

const indent = (): IndentOption =>
  indentSelect.value === 'tab' ? 'tab' : (Number(indentSelect.value) as 2 | 4);

const options = (): BeautifyOptions => ({
  indent: indent(),
  printWidth: Number(widthSelect.value) as PrintWidth,
  singleQuote: quotesOpt.checked,
  semicolons: semiOpt.checked,
  trailingCommas: commasOpt.checked,
});

/** Disable the options that do not apply to the current language and mode. */
function syncControls(): void {
  const lang = language();
  const beautifying = mode() === 'beautify';
  const { script } = LANGUAGES[lang];

  indentSelect.disabled = !beautifying;
  widthSelect.disabled = !beautifying;
  quotesOpt.disabled = !beautifying;
  semiOpt.disabled = !beautifying || !script;
  commasOpt.disabled = !beautifying || !script;

  for (const radio of modeInputs) {
    if (radio.value === 'minify') radio.disabled = !canMinify(lang);
  }

  const editorLanguage = lang === 'json' ? 'json' : 'text';
  input.setLanguage(editorLanguage);
  output.setLanguage(editorLanguage);
}

function reset(): void {
  output.setValue('');
  input.setDiagnostics([]);
  inputStats.textContent = '';
  outputStats.textContent = '';
  setStatus(status, '');
}

async function run(): Promise<void> {
  const id = ++runId;
  const text = input.getValue();
  const lang = language();
  const currentMode = mode();
  input.setDiagnostics([]);

  if (text.trim() === '') {
    reset();
    return;
  }

  const inputBytes = byteLength(text);
  inputStats.textContent = `${formatBytes(inputBytes)} · ${text.split('\n').length} lines`;

  if (!isReady(lang, currentMode)) setStatus(status, 'Loading formatter…');

  try {
    const result =
      currentMode === 'minify' ? await minify(text, lang) : await beautify(text, lang, options());
    if (id !== runId) return;

    output.setValue(result);
    const outputBytes = byteLength(result);
    const label = LANGUAGES[lang].label;

    if (currentMode === 'minify') {
      const saved = savingsPercent(inputBytes, outputBytes);
      outputStats.textContent = `${formatBytes(inputBytes)} → ${formatBytes(outputBytes)} · ${Math.abs(saved)}% ${saved < 0 ? 'larger' : 'smaller'}`;
      setStatus(status, `Minified ${label} — ${saved}% smaller`, 'success');
    } else {
      outputStats.textContent = `${formatBytes(outputBytes)} · ${result.split('\n').length} lines`;
      setStatus(status, `Formatted as ${label}`, 'success');
    }
  } catch (err) {
    if (id !== runId) return;
    output.setValue('');
    outputStats.textContent = '';
    const message =
      err instanceof Error ? err.message : 'The code could not be formatted. Check the syntax.';
    setStatus(status, message, 'error');
    if (err instanceof CodeFormatError && err.position) {
      const from = Math.min(err.position.offset, Math.max(0, text.length - 1));
      input.setDiagnostics([{ from, to: from + 1, message }]);
    }
  }
}

const runDebounced = debounce(() => void run(), 80);

/** Keep the mode legal for the language; explain when Minify is not possible. */
function onLanguageChange(): void {
  const lang = language();
  if (!canMinify(lang) && mode() === 'minify') {
    const beautifyRadio = modeInputs.find((r) => r.value === 'beautify');
    if (beautifyRadio) beautifyRadio.checked = true;
    syncControls();
    void run().then(() => {
      const reason = minifyUnavailableMessage(lang);
      if (reason) setStatus(status, reason, 'error');
    });
    return;
  }
  syncControls();
  void run();
}

languageSelect.addEventListener('change', onLanguageChange);
for (const control of [indentSelect, widthSelect, quotesOpt, semiOpt, commasOpt]) {
  control.addEventListener('change', () => void run());
}
for (const radio of modeInputs) {
  radio.addEventListener('change', () => {
    syncControls();
    void run();
  });
}

root.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.setValue(SAMPLES[language()]);
      void run();
      break;
    case 'clear':
      input.setValue('');
      reset();
      input.focus();
      break;
    case 'copy': {
      const text = output.getValue();
      if (!text) return;
      void copyText(text).then((ok) => {
        if (ok) flashButton(button);
        else
          setStatus(
            status,
            'Clipboard access was blocked — select the output and copy manually.',
            'error',
          );
      });
      break;
    }
    case 'download': {
      const text = output.getValue();
      const lang = language();
      if (text) downloadText(text, fileNameFor(lang, mode()), LANGUAGES[lang].mime);
      break;
    }
  }
});

syncControls();
void run();
