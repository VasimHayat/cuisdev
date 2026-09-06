import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';
import { mountEditor } from '@/lib/editor';

import { ConvertError, describe, type Indent, jsonToYaml, yamlToJson } from './logic';

type Direction = 'json-yaml' | 'yaml-json';

const SAMPLE: Record<Direction, string> = {
  'json-yaml': `{
  "service": "checkout-api",
  "replicas": 3,
  "image": { "repository": "ghcr.io/acme/checkout", "tag": "2.4.1" },
  "ports": [8080, 9090],
  "env": [
    { "name": "LOG_LEVEL", "value": "info" },
    { "name": "FEATURE_FLAGS", "value": "new-cart,fast-pay" }
  ],
  "healthcheck": { "path": "/healthz", "intervalSeconds": 10, "enabled": true },
  "notes": null
}
`,
  'yaml-json': `service: checkout-api
replicas: 3
image:
  repository: ghcr.io/acme/checkout
  tag: "2.4.1"
ports:
  - 8080
  - 9090
env:
  - name: LOG_LEVEL
    value: info
  - name: FEATURE_FLAGS
    value: new-cart,fast-pay
healthcheck:
  path: /healthz
  intervalSeconds: 10
  enabled: true
notes: null
`,
};

const root = $<HTMLElement>('[data-tool="json-to-yaml"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const indentSelect = $<HTMLSelectElement>('[data-opt="indent"]', root);
const minify = $<HTMLInputElement>('[data-opt="minify"]', root);
const directionInputs = $$<HTMLInputElement>('[data-direction] input', root);
const directionOnly = $$<HTMLElement>('[data-only]', root);

const input = mountEditor(inputArea, { language: 'json', onChange: () => runDebounced() });
const output = mountEditor(outputArea, { language: 'yaml', readOnly: true });

const direction = (): Direction =>
  (directionInputs.find((r) => r.checked)?.value as Direction | undefined) ?? 'json-yaml';

const indent = (): Indent => (indentSelect.value === '4' ? 4 : 2);

function setDirection(next: Direction): void {
  for (const r of directionInputs) r.checked = r.value === next;
  updateChrome();
}

function updateChrome(): void {
  const toYaml = direction() === 'json-yaml';
  inputLabel.textContent = toYaml ? 'JSON' : 'YAML';
  outputLabel.textContent = toYaml ? 'YAML' : 'JSON';
  input.setLanguage(toYaml ? 'json' : 'yaml');
  output.setLanguage(toYaml ? 'yaml' : 'json');
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
      direction() === 'json-yaml'
        ? jsonToYaml(text, { indent: indent() })
        : yamlToJson(text, { indent: indent(), minify: minify.checked });
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
indentSelect.addEventListener('change', run);
minify.addEventListener('change', run);

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
      if (direction() === 'json-yaml') downloadText(text, 'converted.yaml', 'application/yaml');
      else downloadText(text, 'converted.json', 'application/json');
      break;
    }

    case 'swap': {
      const text = output.getValue();
      if (!text) return;
      setDirection(direction() === 'json-yaml' ? 'yaml-json' : 'json-yaml');
      input.setValue(text);
      run();
      break;
    }
  }
});

updateChrome();
run();
