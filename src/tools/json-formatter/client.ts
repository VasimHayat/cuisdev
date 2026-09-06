import {
  $,
  $$,
  copyText,
  debounce,
  downloadText,
  flashButton,
  formatBytes,
  onFileDrop,
  setStatus,
} from '@/lib/dom';
import { type Editor, mountEditor } from '@/lib/editor';

import {
  formatJson,
  type Indent,
  JsonParseError,
  jsonStats,
  type JsonValue,
  minifyJson,
  parseJson,
  repairJson,
  summarize,
  typeOf,
} from './logic';

const SAMPLE = `{
  "id": 1024,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "roles": ["admin", "editor"],
  "active": true,
  "profile": {
    "joined": "2024-03-15T09:30:00Z",
    "score": 98.6,
    "address": { "city": "London", "country": "UK" },
    "bio": null
  }
}`;

/** Tree rendering cap — beyond this we show a notice instead of freezing the tab. */
const MAX_TREE_NODES = 5000;

const root = $<HTMLElement>('[data-tool="json-formatter"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const outputArea = $<HTMLTextAreaElement>('[data-output]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const fileInput = $<HTMLInputElement>('[data-file]', root);
const sortOpt = $<HTMLInputElement>('[data-opt="sort"]', root);
const indentInputs = $$<HTMLInputElement>('[data-indent] input', root);
const viewInputs = $$<HTMLInputElement>('[data-view] input', root);
const treeWrap = $<HTMLElement>('[data-tree]', root);
const treeRoot = $<HTMLElement>('[data-tree-root]', root);
const repairBtn = $<HTMLButtonElement>('[data-action="repair"]', root);

const input: Editor = mountEditor(inputArea, { language: 'json', onChange: () => runDebounced() });
const output: Editor = mountEditor(outputArea, { language: 'json', readOnly: true });
// The editor renders inside a shadow root; its host is the `.editor` wrapper after the textarea.
const outputEditorEl = outputArea.nextElementSibling as HTMLElement;

let parsed: JsonValue | undefined;
let minified = false;

const indent = (): Indent => {
  const v = indentInputs.find((r) => r.checked)?.value ?? '2';
  return v === 'tab' ? 'tab' : (Number(v) as 2 | 4);
};
const view = (): 'code' | 'tree' =>
  (viewInputs.find((r) => r.checked)?.value as 'code' | 'tree') ?? 'code';

function run(): void {
  const text = input.getValue();
  input.setDiagnostics([]);
  repairBtn.hidden = true;
  parsed = undefined;

  if (text.trim() === '') {
    output.setValue('');
    inputStats.textContent = '';
    outputStats.textContent = '';
    treeRoot.replaceChildren();
    setStatus(status, '');
    return;
  }

  try {
    parsed = parseJson(text);
    const result = minified
      ? minifyJson(text, { sortKeys: sortOpt.checked })
      : formatJson(text, { indent: indent(), sortKeys: sortOpt.checked });
    output.setValue(result);

    const stats = jsonStats(text, parsed);
    inputStats.textContent = `${formatBytes(stats.bytes)} · ${stats.lines} lines`;
    outputStats.textContent = `${formatBytes(new TextEncoder().encode(result).length)} · ${stats.keys} keys · ${stats.objects} objects · ${stats.arrays} arrays · depth ${stats.depth}`;
    setStatus(status, 'Valid JSON', 'success');
    if (view() === 'tree') renderTree(parsed);
  } catch (err) {
    output.setValue('');
    outputStats.textContent = '';
    treeRoot.replaceChildren();
    inputStats.textContent = `${formatBytes(new TextEncoder().encode(text).length)} · ${text.split('\n').length} lines`;
    if (err instanceof JsonParseError) {
      const message = err.hint ? `${err.message}. ${err.hint}` : err.message;
      setStatus(status, message, 'error');
      if (err.position) {
        const from = err.position.offset;
        input.setDiagnostics([{ from, to: Math.min(from + 1, text.length), message }]);
      }
      // Offer repair when it would help
      try {
        parseJson(repairJson(text));
        repairBtn.hidden = false;
      } catch {
        /* repair would not fix it */
      }
    } else {
      setStatus(status, err instanceof Error ? err.message : 'Could not parse JSON.', 'error');
    }
  }
}

const runDebounced = debounce(run, 80);

// --- tree view ---------------------------------------------------------------

function renderTree(value: JsonValue): void {
  let count = 0;
  const build = (v: JsonValue, key: string | null, depth: number): HTMLElement => {
    count++;
    const type = typeOf(v);
    const isContainer = type === 'object' || type === 'array';

    if (isContainer) {
      const details = document.createElement('details');
      details.className = `json-tree__node json-tree__node--${type}`;
      details.open = depth < 2;
      details.setAttribute('role', 'treeitem');
      const summary = document.createElement('summary');
      summary.className = 'json-tree__row';
      if (key !== null) appendKey(summary, key);
      const meta = document.createElement('span');
      meta.className = 'json-tree__meta';
      meta.textContent = summarize(v);
      summary.append(meta);
      details.append(summary);

      const children = document.createElement('div');
      children.className = 'json-tree__children';
      children.setAttribute('role', 'group');
      const entries: [string, JsonValue][] = Array.isArray(v)
        ? v.map((item, i) => [String(i), item])
        : Object.entries(v as Record<string, JsonValue>);
      for (const [k, child] of entries) {
        if (count > MAX_TREE_NODES) break;
        children.append(build(child, k, depth + 1));
      }
      details.append(children);
      return details;
    }

    const row = document.createElement('div');
    row.className = 'json-tree__row json-tree__leaf';
    row.setAttribute('role', 'treeitem');
    if (key !== null) appendKey(row, key);
    const val = document.createElement('span');
    val.className = `json-tree__value json-tree__value--${type}`;
    val.textContent = type === 'string' ? JSON.stringify(v) : String(v);
    row.append(val);
    return row;
  };

  const frag = document.createDocumentFragment();
  frag.append(build(value, null, 0));
  if (count > MAX_TREE_NODES) {
    const note = document.createElement('p');
    note.className = 'json-tree__note';
    note.textContent = `Tree view shows the first ${MAX_TREE_NODES.toLocaleString()} nodes. Use the Code view for the full document.`;
    frag.append(note);
  }
  treeRoot.replaceChildren(frag);
}

function appendKey(row: HTMLElement, key: string): void {
  const k = document.createElement('span');
  k.className = 'json-tree__key';
  k.textContent = key;
  row.append(k);
  const colon = document.createElement('span');
  colon.className = 'json-tree__colon';
  colon.textContent = ':';
  row.append(colon);
}

function applyView(): void {
  const tree = view() === 'tree';
  treeWrap.hidden = !tree;
  outputEditorEl.hidden = tree;
  if (tree && parsed !== undefined) renderTree(parsed);
}

// --- events ------------------------------------------------------------------

for (const r of indentInputs) r.addEventListener('change', () => ((minified = false), run()));
for (const r of viewInputs) r.addEventListener('change', applyView);
sortOpt.addEventListener('change', run);

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) {
    input.setValue(await file.text());
    run();
  }
  fileInput.value = '';
});

onFileDrop(root, async (files) => {
  const file = files[0];
  if (file) {
    input.setValue(await file.text());
    run();
  }
});

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      minified = false;
      input.setValue(SAMPLE);
      run();
      break;
    case 'clear':
      minified = false;
      input.setValue('');
      run();
      input.focus();
      break;
    case 'minify':
      minified = !minified;
      button.setAttribute('aria-pressed', String(minified));
      run();
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
    case 'download':
      if (output.getValue())
        downloadText(
          output.getValue(),
          minified ? 'data.min.json' : 'data.json',
          'application/json',
        );
      break;
    case 'repair':
      input.setValue(repairJson(input.getValue()));
      run();
      input.focus();
      break;
    case 'expand-all':
      for (const d of treeRoot.querySelectorAll('details')) d.open = true;
      break;
    case 'collapse-all':
      for (const d of treeRoot.querySelectorAll('details')) d.open = false;
      break;
  }
});

applyView();
run();
