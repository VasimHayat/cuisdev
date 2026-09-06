import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';
import { mountEditor } from '@/lib/editor';

import {
  ConvertError,
  csvToJson,
  type Delimiter,
  delimiterName,
  describe,
  jsonToCsv,
} from './logic';

type Direction = 'json-csv' | 'csv-json';

const SAMPLE: Record<Direction, string> = {
  'json-csv': `[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "address": { "city": "London", "country": "UK" },
    "roles": ["admin", "editor"],
    "active": true
  },
  {
    "id": 2,
    "name": "Grace Hopper, PhD",
    "email": "grace@example.com",
    "address": { "city": "New York", "country": "US" },
    "roles": ["editor"],
    "active": true
  },
  {
    "id": 3,
    "name": "Linus Torvalds",
    "email": "linus@example.com",
    "address": { "city": "Portland", "country": "US" },
    "roles": [],
    "active": false
  }
]
`,
  'csv-json': `id,name,email,city,country,active
1,Ada Lovelace,ada@example.com,London,UK,true
2,"Grace Hopper, PhD",grace@example.com,New York,US,true
3,Linus Torvalds,linus@example.com,Portland,US,false
`,
};

const root = $<HTMLElement>('[data-tool="json-to-csv"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const outDelimiter = $<HTMLSelectElement>('[data-opt="out-delimiter"]', root);
const outHeader = $<HTMLInputElement>('[data-opt="out-header"]', root);
const quoteAll = $<HTMLInputElement>('[data-opt="quote-all"]', root);
const inDelimiter = $<HTMLSelectElement>('[data-opt="in-delimiter"]', root);
const inHeader = $<HTMLInputElement>('[data-opt="in-header"]', root);
const typing = $<HTMLInputElement>('[data-opt="typing"]', root);
const minify = $<HTMLInputElement>('[data-opt="minify"]', root);
const directionInputs = $$<HTMLInputElement>('[data-direction] input', root);
const directionOnly = $$<HTMLElement>('[data-only]', root);

const input = mountEditor(inputArea, { language: 'json', onChange: () => runDebounced() });
const output = mountEditor(outputArea, { language: 'text', readOnly: true });

const direction = (): Direction =>
  (directionInputs.find((r) => r.checked)?.value as Direction | undefined) ?? 'json-csv';

/** The <option> values use "tab" because a literal tab does not survive HTML. */
function delimiterValue(select: HTMLSelectElement): Delimiter | 'auto' {
  const v = select.value;
  if (v === 'tab') return '\t';
  if (v === ',' || v === ';' || v === '|') return v;
  return 'auto';
}

function setDirection(next: Direction): void {
  for (const r of directionInputs) r.checked = r.value === next;
  updateChrome();
}

function updateChrome(): void {
  const toCsv = direction() === 'json-csv';
  inputLabel.textContent = toCsv ? 'JSON' : 'CSV';
  outputLabel.textContent = toCsv ? 'CSV' : 'JSON';
  input.setLanguage(toCsv ? 'json' : 'text');
  output.setLanguage(toCsv ? 'text' : 'json');
  for (const el of directionOnly) el.hidden = el.dataset.only !== direction();
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

function run(): void {
  const text = input.getValue();
  inputStats.textContent = describe(text);

  if (text.trim() === '') {
    output.setValue('');
    outputStats.textContent = '';
    input.setDiagnostics([]);
    setStatus(status, '');
    return;
  }

  try {
    if (direction() === 'json-csv') {
      const delimiter = delimiterValue(outDelimiter);
      const result = jsonToCsv(text, {
        delimiter: delimiter === 'auto' ? ',' : delimiter,
        header: outHeader.checked,
        quoteAll: quoteAll.checked,
      });
      output.setValue(result.csv);
      outputStats.textContent =
        result.rows === 0
          ? 'Empty array — no rows to write'
          : `${plural(result.rows, 'row')} · ${plural(result.columns, 'column')} · ${describe(result.csv)}`;
      setStatus(status, '');
    } else {
      const delimiter = delimiterValue(inDelimiter);
      const result = csvToJson(text, {
        header: inHeader.checked,
        delimiter,
        dynamicTyping: typing.checked,
        minify: minify.checked,
        indent: 2,
      });
      output.setValue(result.json);
      outputStats.textContent = `${plural(result.rows, 'row')} · ${plural(result.columns, 'column')} · ${delimiterName(result.delimiter)} delimiter · ${describe(result.json)}`;
      setStatus(status, result.warnings.join(' '), 'info');
    }
    input.setDiagnostics([]);
  } catch (err) {
    output.setValue('');
    outputStats.textContent = '';
    const message = err instanceof Error ? err.message : 'Could not convert.';
    if (err instanceof ConvertError && err.offset !== undefined) {
      // Offsets are relative to the BOM-stripped source.
      const shift = text.charCodeAt(0) === 0xfeff ? 1 : 0;
      const from = err.offset + shift;
      input.setDiagnostics([{ from, to: from + 1, message }]);
    } else {
      input.setDiagnostics([]);
    }
    setStatus(status, message, 'error');
  }
}

const runDebounced = debounce(run, 80);

// --- events -----------------------------------------------------------------

for (const r of directionInputs) {
  r.addEventListener('change', () => {
    updateChrome();
    run();
  });
}
for (const el of [outDelimiter, outHeader, quoteAll, inDelimiter, inHeader, typing, minify]) {
  el.addEventListener('change', run);
}

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.setValue(SAMPLE[direction()]);
      run();
      input.focus();
      break;

    case 'clear':
      input.setValue('');
      run();
      input.focus();
      break;

    case 'copy': {
      const text = output.getValue();
      if (!text) return;
      if (await copyText(text)) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the output and copy manually.',
          'error',
        );
      break;
    }

    case 'download': {
      const text = output.getValue();
      if (!text) return;
      if (direction() === 'json-csv') {
        const tab = delimiterValue(outDelimiter) === '\t';
        downloadText(
          text,
          tab ? 'converted.tsv' : 'converted.csv',
          tab ? 'text/tab-separated-values' : 'text/csv',
        );
      } else {
        downloadText(text, 'converted.json', 'application/json');
      }
      break;
    }

    case 'swap': {
      const text = output.getValue();
      if (!text) return;
      setDirection(direction() === 'json-csv' ? 'csv-json' : 'json-csv');
      input.setValue(text);
      run();
      break;
    }
  }
});

updateChrome();
run();
