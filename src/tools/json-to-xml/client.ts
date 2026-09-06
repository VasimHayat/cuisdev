import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';
import { mountEditor } from '@/lib/editor';

import { ConvertError, describe, type Indent, jsonToXml, xmlToJson } from './logic';

type Direction = 'json-xml' | 'xml-json';

const SAMPLE: Record<Direction, string> = {
  'json-xml': `{
  "@_version": "2.1",
  "book": [
    {
      "@_id": "bk101",
      "title": "XML Developer's Guide",
      "author": "Gambardella, Matthew",
      "price": 44.95,
      "inStock": true
    },
    {
      "@_id": "bk102",
      "title": "Midnight Rain",
      "author": "Ralls, Kim",
      "price": 5.95,
      "inStock": false
    }
  ],
  "note": null
}
`,
  'xml-json': `<?xml version="1.0" encoding="UTF-8"?>
<catalog version="2.1">
  <book id="bk101">
    <title>XML Developer's Guide</title>
    <author>Gambardella, Matthew</author>
    <price>44.95</price>
    <inStock>true</inStock>
  </book>
  <book id="bk102">
    <title>Midnight Rain</title>
    <author>Ralls, Kim</author>
    <price>5.95</price>
    <inStock>false</inStock>
  </book>
  <!-- Comments are dropped when converting to JSON -->
  <note/>
</catalog>
`,
};

const root = $<HTMLElement>('[data-tool="json-to-xml"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const rootName = $<HTMLInputElement>('[data-opt="root"]', root);
const indentSelect = $<HTMLSelectElement>('[data-opt="indent"]', root);
const prefix = $<HTMLInputElement>('[data-opt="prefix"]', root);
const declaration = $<HTMLInputElement>('[data-opt="declaration"]', root);
const ignoreAttributes = $<HTMLInputElement>('[data-opt="ignore-attributes"]', root);
const parseValues = $<HTMLInputElement>('[data-opt="parse-values"]', root);
const minify = $<HTMLInputElement>('[data-opt="minify"]', root);
const directionInputs = $$<HTMLInputElement>('[data-direction] input', root);
const directionOnly = $$<HTMLElement>('[data-only]', root);

const input = mountEditor(inputArea, { language: 'json', onChange: () => runDebounced() });
const output = mountEditor(outputArea, { language: 'xml', readOnly: true });

const direction = (): Direction =>
  (directionInputs.find((r) => r.checked)?.value as Direction | undefined) ?? 'json-xml';

const indent = (): Indent => (indentSelect.value === '4' ? 4 : 2);

function setDirection(next: Direction): void {
  for (const r of directionInputs) r.checked = r.value === next;
  updateChrome();
}

function updateChrome(): void {
  const toXml = direction() === 'json-xml';
  inputLabel.textContent = toXml ? 'JSON' : 'XML';
  outputLabel.textContent = toXml ? 'XML' : 'JSON';
  input.setLanguage(toXml ? 'json' : 'xml');
  output.setLanguage(toXml ? 'xml' : 'json');
  for (const el of directionOnly) el.hidden = el.dataset.only !== direction();
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
    const result =
      direction() === 'json-xml'
        ? jsonToXml(text, {
            rootName: rootName.value,
            indent: indent(),
            declaration: declaration.checked,
            attributePrefix: prefix.value,
          })
        : xmlToJson(text, {
            ignoreAttributes: ignoreAttributes.checked,
            parseValues: parseValues.checked,
            minify: minify.checked,
            indent: indent(),
            attributePrefix: prefix.value,
          });
    output.setValue(result);
    outputStats.textContent = describe(result);
    input.setDiagnostics([]);
    setStatus(status, '');
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
for (const el of [indentSelect, declaration, ignoreAttributes, parseValues, minify]) {
  el.addEventListener('change', run);
}
rootName.addEventListener('input', runDebounced);
prefix.addEventListener('input', runDebounced);

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
      if (direction() === 'json-xml') downloadText(text, 'converted.xml', 'application/xml');
      else downloadText(text, 'converted.json', 'application/json');
      break;
    }

    case 'swap': {
      const text = output.getValue();
      if (!text) return;
      setDirection(direction() === 'json-xml' ? 'xml-json' : 'json-xml');
      input.setValue(text);
      run();
      break;
    }
  }
});

updateChrome();
run();
