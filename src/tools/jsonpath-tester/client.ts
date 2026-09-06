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
  describeCount,
  JsonParseError,
  JsonPathError,
  RESULT_TYPES,
  type ResultType,
  runQuery,
} from './logic';

const SAMPLE_PATH = '$.store.book[?(@.price < 10)].title';
const SAMPLE_JSON = `{
  "store": {
    "book": [
      {
        "category": "reference",
        "author": "Nigel Rees",
        "title": "Sayings of the Century",
        "price": 8.95
      },
      {
        "category": "fiction",
        "author": "Evelyn Waugh",
        "title": "Sword of Honour",
        "price": 12.99
      },
      {
        "category": "fiction",
        "author": "Herman Melville",
        "title": "Moby Dick",
        "isbn": "0-553-21311-3",
        "price": 8.99
      },
      {
        "category": "fiction",
        "author": "J. R. R. Tolkien",
        "title": "The Lord of the Rings",
        "isbn": "0-395-19395-8",
        "price": 22.99
      }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95
    }
  }
}`;

const root = $<HTMLElement>('[data-tool="jsonpath-tester"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const pathInput = $<HTMLInputElement>('[data-path]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const typeInputs = $$<HTMLInputElement>('[data-result-type] input', root);

const encoder = new TextEncoder();

const input = mountEditor(inputArea, {
  language: 'json',
  onChange: () => {
    if (!programmatic) runDebounced();
  },
});
const output = mountEditor(outputArea, { language: 'json', readOnly: true });

/**
 * Set an editor's value without scheduling the debounced run: programmatic
 * changes (Sample, Clear, Generate) call run() themselves and may set their own
 * status afterwards, which a trailing debounced run would overwrite.
 */
let programmatic = false;
function setEditorValue(editor: Editor, value: string): void {
  programmatic = true;
  try {
    editor.setValue(value);
  } finally {
    programmatic = false;
  }
}

function resultType(): ResultType {
  const value = typeInputs.find((r) => r.checked)?.value as ResultType | undefined;
  return value && RESULT_TYPES.includes(value) ? value : 'value';
}

function stats(el: HTMLElement, text: string): void {
  el.textContent =
    text.length === 0
      ? ''
      : `${text.length.toLocaleString()} chars · ${formatBytes(encoder.encode(text).length)}`;
}

function run(): void {
  const jsonText = input.getValue();
  const path = pathInput.value;
  input.setDiagnostics([]);
  pathInput.removeAttribute('aria-invalid');
  stats(inputStats, jsonText);

  if (jsonText.trim() === '' && path.trim() === '') {
    output.setValue('');
    outputStats.textContent = '';
    setStatus(status, '');
    return;
  }
  if (jsonText.trim() === '') {
    output.setValue('');
    outputStats.textContent = '';
    setStatus(status, 'Paste a JSON document to run the expression against.');
    return;
  }
  if (path.trim() === '') {
    output.setValue('');
    outputStats.textContent = '';
    setStatus(status, 'Enter a JSONPath expression, e.g. $.store.book[*].title');
    return;
  }

  try {
    const result = runQuery(jsonText, path, resultType());
    output.setValue(result.output);
    outputStats.textContent = describeCount(result.count);
    setStatus(status, '');
  } catch (err) {
    output.setValue('');
    outputStats.textContent = '';
    if (err instanceof JsonParseError) {
      if (err.offset !== undefined) {
        const from = Math.max(0, Math.min(err.offset, jsonText.length - 1));
        input.setDiagnostics([{ from, to: from + 1, message: err.message }]);
      }
      setStatus(status, err.message, 'error');
    } else if (err instanceof JsonPathError) {
      pathInput.setAttribute('aria-invalid', 'true');
      setStatus(status, err.message, 'error');
    } else {
      throw err;
    }
  }
}

const runDebounced = debounce(run, 100);

pathInput.addEventListener('input', runDebounced);
for (const r of typeInputs) r.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      pathInput.value = SAMPLE_PATH;
      setEditorValue(input, SAMPLE_JSON);
      run();
      break;

    case 'clear':
      setEditorValue(input, '');
      pathInput.value = '';
      run();
      input.focus();
      break;

    case 'copy': {
      const text = output.getValue();
      if (!text) return;
      const ok = await copyText(text);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the result and copy manually.',
          'error',
        );
      break;
    }

    case 'download': {
      const text = output.getValue();
      if (text) downloadText(text, 'jsonpath-result.json', 'application/json');
      break;
    }
  }
});

run();
