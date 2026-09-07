import { $, $$, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';
import { type Editor, mountEditor } from '@/lib/editor';

import type * as LogicModule from './logic';
import type { JsonParseError, ValidationIssue } from './logic';

/**
 * Ajv is ~190 KB and compiles schemas with `new Function`, so it is loaded as a
 * separate chunk right after paint instead of blocking it. Everything that
 * touches the module goes through `logic`, which is undefined until it lands.
 */
type Logic = typeof LogicModule;
let logic: Logic | undefined;

const SAMPLE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "User",
  "type": "object",
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "integer", "minimum": 13, "maximum": 120 },
    "roles": {
      "type": "array",
      "items": { "type": "string", "enum": ["admin", "editor", "viewer"] },
      "uniqueItems": true
    }
  },
  "required": ["id", "name", "email"],
  "additionalProperties": false
}`;

const SAMPLE_DATA = `{
  "id": 42,
  "name": "Ada Lovelace",
  "email": "ada.lovelace",
  "age": 9,
  "roles": ["admin"]
}`;

type View = 'empty' | 'valid' | 'problem' | 'errors';

const root = $<HTMLElement>('[data-tool="json-schema-validator"]');
const schemaArea = $<HTMLTextAreaElement>('[data-schema]', root);
const dataArea = $<HTMLTextAreaElement>('[data-data]', root);
const schemaStats = $('[data-schema-stats]', root);
const dataStats = $('[data-data-stats]', root);
const status = $('[data-status]', root);
const views = $$<HTMLElement>('[data-view]', root);
const validText = $('[data-valid-text]', root);
const problemTitle = $('[data-problem-title]', root);
const problemText = $('[data-problem-text]', root);
const errorList = $<HTMLUListElement>('[data-error-list]', root);

const encoder = new TextEncoder();

/** Errors from the latest run, for "Copy errors" and click-to-focus. */
let currentErrors: ValidationIssue[] = [];

/**
 * One-off success message (set by Generate) shown instead of the plain "Valid"
 * status until the user edits again. It must survive a debounced run that an
 * earlier keystroke may still have pending.
 */
let notice: string | undefined;

const onChange = (): void => {
  if (programmatic) return;
  notice = undefined;
  runDebounced();
};
const schemaEditor = mountEditor(schemaArea, { language: 'json', onChange });
const dataEditor = mountEditor(dataArea, { language: 'json', onChange });

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

function showView(view: View): void {
  for (const el of views) el.hidden = el.dataset.view !== view;
}

function showProblem(kind: 'schema' | 'data', message: string): void {
  problemTitle.textContent = kind === 'schema' ? 'Schema problem' : 'JSON data problem';
  problemText.textContent = message;
  problemTitle.parentElement?.setAttribute('data-kind', kind);
  showView('problem');
}

function stats(el: HTMLElement, text: string, extra?: string): void {
  if (text.length === 0) {
    el.textContent = '';
    return;
  }
  const parts = [`${text.length.toLocaleString()} chars`, formatBytes(encoder.encode(text).length)];
  if (extra) parts.unshift(extra);
  el.textContent = parts.join(' · ');
}

function renderErrors(errors: ValidationIssue[]): void {
  errorList.replaceChildren();
  errors.forEach((error, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-json-schema-validator__error';
    button.dataset.errorIndex = String(index);
    button.setAttribute(
      'aria-label',
      `${error.path} ${error.message} (${error.keyword}). Jump to this value in the JSON data.`,
    );

    const path = document.createElement('code');
    path.className = 'tool-json-schema-validator__path';
    path.textContent = error.path;

    const message = document.createElement('span');
    message.className = 'tool-json-schema-validator__message';
    message.textContent = error.message;

    const keyword = document.createElement('span');
    keyword.className = 'badge tool-json-schema-validator__keyword';
    keyword.textContent = error.keyword;

    button.append(path, message, keyword);
    li.append(button);
    errorList.append(li);
  });
  showView('errors');
}

function highlightParseError(editor: typeof dataEditor, err: JsonParseError): void {
  if (err.offset === undefined) return;
  const from = Math.max(0, Math.min(err.offset, editor.getValue().length - 1));
  editor.setDiagnostics([{ from, to: from + 1, message: err.message }]);
}

function run(): void {
  const schemaText = schemaEditor.getValue();
  const dataText = dataEditor.getValue();
  currentErrors = [];
  errorList.replaceChildren();
  schemaEditor.setDiagnostics([]);
  dataEditor.setDiagnostics([]);
  stats(schemaStats, schemaText);
  stats(dataStats, dataText);

  const hasSchema = schemaText.trim() !== '';
  const hasData = dataText.trim() !== '';

  // The validator chunk is still downloading; run() is called again once it lands.
  if (!logic) return;

  if (!hasSchema && !hasData) {
    showView('empty');
    setStatus(status, '');
    return;
  }

  // 1. The schema must parse and compile before anything else is meaningful.
  let compiled: ReturnType<Logic['compileSchema']>;
  let schema: unknown;
  if (!hasSchema) {
    showView('empty');
    setStatus(
      status,
      'Paste a JSON Schema on the left, or click “Generate from data” to draft one from your JSON.',
    );
    return;
  }
  try {
    schema = logic.parseJson(schemaText, 'schema');
    compiled = logic.compileSchema(schema);
  } catch (err) {
    if (err instanceof logic.JsonParseError) {
      highlightParseError(schemaEditor, err);
      showProblem('schema', err.message);
      setStatus(status, err.message, 'error');
    } else if (err instanceof logic.SchemaError) {
      showProblem('schema', err.message);
      setStatus(status, `Schema error: ${err.message}`, 'error');
    } else {
      throw err;
    }
    return;
  }
  const draft = logic.DRAFT_LABEL[compiled.draft];
  stats(schemaStats, schemaText, draft);

  // 2. Then the data.
  if (!hasData) {
    showView('empty');
    setStatus(status, `Schema compiled (${draft}). Paste JSON data on the right to validate it.`);
    return;
  }
  let data: unknown;
  try {
    data = logic.parseJson(dataText, 'data');
  } catch (err) {
    if (!(err instanceof logic.JsonParseError)) throw err;
    highlightParseError(dataEditor, err);
    showProblem('data', err.message);
    setStatus(status, err.message, 'error');
    return;
  }

  // 3. Validate.
  const result = logic.validateData(schema, data);
  if (result.valid) {
    validText.textContent = `Valid — the JSON data matches the schema (${draft}).`;
    showView('valid');
    setStatus(status, notice ?? `Valid — no errors found (${draft}).`, 'success');
    return;
  }
  currentErrors = result.errors;
  renderErrors(result.errors);
  const n = result.errors.length;
  setStatus(
    status,
    `${n.toLocaleString()} ${n === 1 ? 'error' : 'errors'} found — click an error to jump to it in the JSON data.`,
    'error',
  );
}

const runDebounced = debounce(run, 120);

function focusError(index: number): void {
  const error = currentErrors[index];
  if (!error || !logic) return;
  const offset = logic.findPathOffset(dataEditor.getValue(), error.path);
  dataEditor.revealOffset(offset ?? 0);
}

root.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const errorButton = target.closest<HTMLButtonElement>('[data-error-index]');
  if (errorButton) {
    focusError(Number(errorButton.dataset.errorIndex));
    return;
  }

  const button = target.closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      notice = undefined;
      setEditorValue(schemaEditor, SAMPLE_SCHEMA);
      setEditorValue(dataEditor, SAMPLE_DATA);
      run();
      break;

    case 'clear':
      notice = undefined;
      setEditorValue(schemaEditor, '');
      setEditorValue(dataEditor, '');
      run();
      schemaEditor.focus();
      break;

    case 'generate': {
      try {
        if (!logic) return;
        const generated = logic.inferSchemaText(dataEditor.getValue());
        notice =
          'Generated a draft 2020-12 schema from the JSON data — every key is required; loosen it as needed.';
        setEditorValue(schemaEditor, generated);
        run();
      } catch (err) {
        if (!logic || !(err instanceof logic.JsonParseError)) throw err;
        highlightParseError(dataEditor, err);
        setStatus(status, `Cannot generate a schema: ${err.message}`, 'error');
      }
      break;
    }

    case 'copy-errors': {
      if (currentErrors.length === 0) {
        setStatus(status, 'There are no validation errors to copy.');
        return;
      }
      if (!logic) return;
      const ok = await copyText(logic.errorsToJson(currentErrors));
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the errors and copy manually.',
          'error',
        );
      break;
    }
  }
});

setStatus(status, 'Loading the validator…');
void import('./logic').then((module) => {
  logic = module;
  run();
});
