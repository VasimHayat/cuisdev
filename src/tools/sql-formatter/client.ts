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
  byteLength,
  type CaseOption,
  type DialectId,
  dialectLabel,
  fileNameFor,
  formatSql,
  type IndentOption,
  isDialectId,
  isReady,
  type LinesBetweenQueries,
  minifySql,
  type Mode,
  SAMPLE,
  savingsPercent,
  SqlFormatError,
  type SqlFormatOptions,
} from './logic';

const root = $<HTMLElement>('[data-tool="sql-formatter"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);

const dialectSelect = $<HTMLSelectElement>('[data-opt="dialect"]', root);
const keywordCaseSelect = $<HTMLSelectElement>('[data-opt="keyword-case"]', root);
const typeCaseSelect = $<HTMLSelectElement>('[data-opt="type-case"]', root);
const functionCaseSelect = $<HTMLSelectElement>('[data-opt="function-case"]', root);
const indentSelect = $<HTMLSelectElement>('[data-opt="indent"]', root);
const linesSelect = $<HTMLSelectElement>('[data-opt="lines"]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const input: Editor = mountEditor(inputArea, { language: 'text', onChange: () => runDebounced() });
const output: Editor = mountEditor(outputArea, { language: 'text', readOnly: true });

/** Ignore results from a run the user has already superseded. */
let runId = 0;

const dialect = (): DialectId => (isDialectId(dialectSelect.value) ? dialectSelect.value : 'sql');

const mode = (): Mode =>
  modeInputs.find((r) => r.checked)?.value === 'minify' ? 'minify' : 'format';

const caseOf = (select: HTMLSelectElement): CaseOption =>
  select.value === 'upper' || select.value === 'lower' ? select.value : 'preserve';

const options = (): SqlFormatOptions => ({
  dialect: dialect(),
  keywordCase: caseOf(keywordCaseSelect),
  dataTypeCase: caseOf(typeCaseSelect),
  functionCase: caseOf(functionCaseSelect),
  indent: indentSelect.value === 'tab' ? 'tab' : (Number(indentSelect.value) as IndentOption),
  linesBetweenQueries: Number(linesSelect.value) as LinesBetweenQueries,
});

/** Minify ignores the layout options, so grey them out instead of hiding them. */
function syncControls(): void {
  const formatting = mode() === 'format';
  for (const select of [
    keywordCaseSelect,
    typeCaseSelect,
    functionCaseSelect,
    indentSelect,
    linesSelect,
  ]) {
    select.disabled = !formatting;
  }
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
  const currentMode = mode();
  input.setDiagnostics([]);

  if (text.trim() === '') {
    reset();
    return;
  }

  const inputBytes = byteLength(text);
  inputStats.textContent = `${formatBytes(inputBytes)} · ${text.split('\n').length} lines`;

  if (currentMode === 'format' && !isReady()) setStatus(status, 'Loading formatter…');

  try {
    const result = currentMode === 'minify' ? minifySql(text) : await formatSql(text, options());
    if (id !== runId) return;

    output.setValue(result);
    const outputBytes = byteLength(result);

    if (currentMode === 'minify') {
      const saved = savingsPercent(inputBytes, outputBytes);
      outputStats.textContent = `${formatBytes(inputBytes)} → ${formatBytes(outputBytes)} · ${Math.abs(saved)}% ${saved < 0 ? 'larger' : 'smaller'}`;
      setStatus(status, `Minified SQL — ${saved}% smaller`, 'success');
    } else {
      outputStats.textContent = `${formatBytes(outputBytes)} · ${result.split('\n').length} lines`;
      setStatus(status, `Formatted as ${dialectLabel(dialect())}`, 'success');
    }
  } catch (err) {
    if (id !== runId) return;
    output.setValue('');
    outputStats.textContent = '';
    const message =
      err instanceof Error ? err.message : 'The query could not be formatted. Check the syntax.';
    setStatus(status, message, 'error');
    if (err instanceof SqlFormatError && err.position) {
      const from = Math.min(err.position.offset, Math.max(0, text.length - 1));
      input.setDiagnostics([{ from, to: from + 1, message }]);
    }
  }
}

const runDebounced = debounce(() => void run(), 80);

for (const control of [
  dialectSelect,
  keywordCaseSelect,
  typeCaseSelect,
  functionCaseSelect,
  indentSelect,
  linesSelect,
]) {
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
      input.setValue(SAMPLE);
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
      if (text) downloadText(text, fileNameFor(mode()), 'application/sql');
      break;
    }
  }
});

syncControls();
void run();
