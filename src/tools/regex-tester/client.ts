import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  buildRegex,
  describeMatchCount,
  highlightSegments,
  matchesToText,
  type RegexMatch,
  type RegexRequest,
  type RegexResult,
  runRegex,
} from './logic';
import type { WorkerRequest, WorkerResponse } from './worker';

/** A pattern that has not answered in this long is assumed to be backtracking. */
const TIMEOUT_MS = 2000;
const TIMEOUT_MESSAGE =
  'Pattern took too long — likely catastrophic backtracking. Try un-nesting quantifiers such as (a+)+ or anchoring the pattern.';

const SAMPLE = {
  pattern: '(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.-]{2,})',
  flags: ['g', 'i'],
  replacement: '$<user> [at] $<domain>',
  text: `Contact ada@example.com or grace.hopper@navy.mil before Friday.
Billing questions go to accounts+urgent@cuisdev.dev, anything else to hi@cuisdev.dev when in doubt.
This one is not an address: support@ (no domain), and neither is @cuisdev on its own.`,
};

const root = $<HTMLElement>('[data-tool="regex-tester"]');
const patternInput = $<HTMLInputElement>('[data-pattern]', root);
const replacementInput = $<HTMLInputElement>('[data-replacement]', root);
const input = $<HTMLTextAreaElement>('[data-input]', root);
const replaced = $<HTMLTextAreaElement>('[data-replaced]', root);
const highlight = $<HTMLElement>('[data-highlight]', root);
const rows = $<HTMLTableSectionElement>('[data-rows]', root);
const tableWrap = $<HTMLElement>('[data-table-wrap]', root);
const countEl = $('[data-count]', root);
const inputStats = $('[data-input-stats]', root);
const status = $('[data-status]', root);
const flagBoxes = $$<HTMLInputElement>('[data-flag]', root);

let lastMatches: RegexMatch[] = [];

const currentFlags = (): string =>
  flagBoxes
    .filter((box) => box.checked)
    .map((box) => box.value)
    .join('');

// --- worker plumbing ---------------------------------------------------------

let worker: Worker | null = null;
let workerUnavailable = false;
let workerReady = false;
/** Held until the worker says hello, so start-up never eats the 2 s budget. */
let queued: WorkerRequest | null = null;
let requestId = 0;
let timer: number | undefined;

function stopWorker(): void {
  worker?.terminate();
  worker = null;
  workerReady = false;
  queued = null;
}

function dispatch(active: Worker, message: WorkerRequest): void {
  timer = window.setTimeout(onTimeout, TIMEOUT_MS);
  active.postMessage(message);
}

function ensureWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (worker) return worker;
  try {
    const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    created.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.ready) {
        workerReady = true;
        const next = queued;
        queued = null;
        if (next && next.id === requestId) dispatch(created, next);
        return;
      }
      if (data.id !== requestId) return; // a stale answer from an earlier keystroke
      window.clearTimeout(timer);
      apply(data.result);
    });
    created.addEventListener('error', () => {
      // The worker could not start (blocked, or an old browser) — fall back.
      stopWorker();
      workerUnavailable = true;
      window.clearTimeout(timer);
      run();
    });
    worker = created;
    return created;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

function onTimeout(): void {
  // The worker is stuck inside the regex engine; only terminate() can stop it.
  stopWorker();
  clearResults();
  setStatus(status, TIMEOUT_MESSAGE, 'error');
}

// --- rendering ---------------------------------------------------------------

function clearResults(): void {
  lastMatches = [];
  rows.replaceChildren();
  tableWrap.hidden = true;
  replaced.value = '';
  countEl.textContent = 'No matches';
  renderPlaceholder();
}

function renderPlaceholder(): void {
  const span = document.createElement('span');
  span.className = 'tool-regex-tester__placeholder';
  span.textContent = 'Matches are highlighted here as you type.';
  highlight.replaceChildren(span);
}

/** Rebuild the test string with <mark> elements — never innerHTML with user text. */
function renderHighlight(text: string, matches: readonly RegexMatch[]): void {
  if (text === '') {
    renderPlaceholder();
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const segment of highlightSegments(text, matches)) {
    if (segment.matchIndex === null) {
      fragment.append(document.createTextNode(segment.text));
      continue;
    }
    const mark = document.createElement('mark');
    mark.className =
      segment.matchIndex % 2 === 0 ? 'regex__match' : 'regex__match regex__match--alt';
    mark.textContent = segment.text;
    fragment.append(mark);
  }
  highlight.replaceChildren(fragment);
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function groupsCell(match: RegexMatch): HTMLTableCellElement {
  const td = document.createElement('td');
  if (match.groups.length === 0) {
    td.className = 'tool-regex-tester__muted';
    td.textContent = '—';
    return td;
  }
  const list = document.createElement('ul');
  list.className = 'tool-regex-tester__groups';
  for (const group of match.groups) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'tool-regex-tester__group-label';
    label.textContent = group.label;
    const value = document.createElement('span');
    if (group.value === undefined) {
      value.className = 'tool-regex-tester__muted';
      value.textContent = 'did not match';
    } else {
      value.className = 'tool-regex-tester__mono';
      value.textContent = group.value;
    }
    item.append(label, value);
    list.append(item);
  }
  td.append(list);
  return td;
}

function renderRows(matches: readonly RegexMatch[]): void {
  const fragment = document.createDocumentFragment();
  for (const match of matches) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = String(match.index + 1);
    tr.append(th);
    tr.append(cell(match.value, 'tool-regex-tester__mono'));
    tr.append(cell(`${match.start}–${match.end}`, 'tool-regex-tester__mono'));
    tr.append(groupsCell(match));
    fragment.append(tr);
  }
  rows.replaceChildren(fragment);
  tableWrap.hidden = matches.length === 0;
}

function apply(result: RegexResult): void {
  if (!result.ok) {
    clearResults();
    patternInput.setAttribute('aria-invalid', 'true');
    setStatus(status, result.error, 'error');
    return;
  }
  patternInput.setAttribute('aria-invalid', 'false');
  lastMatches = result.matches;
  renderHighlight(input.value, result.matches);
  renderRows(result.matches);
  countEl.textContent = describeMatchCount(result.matches.length, result.truncated);
  replaced.value = result.replaced ?? '';
  if (result.truncated) {
    setStatus(status, 'Too many matches to list — showing the first batch.', 'info');
  } else {
    setStatus(status, '');
  }
}

// --- running -----------------------------------------------------------------

function run(): void {
  const pattern = patternInput.value;
  const flags = currentFlags();
  const text = input.value;
  const replacement = replacementInput.value;

  inputStats.textContent =
    text === '' ? '' : `${text.length.toLocaleString()} chars · ${text.split('\n').length} lines`;

  // Bump the id first: any answer still in flight is now stale and must not
  // overwrite what this run is about to show.
  const id = ++requestId;
  window.clearTimeout(timer);

  if (pattern === '') {
    patternInput.setAttribute('aria-invalid', 'false');
    clearResults();
    setStatus(status, '');
    return;
  }

  // Compiling never backtracks, so syntax errors are reported instantly here
  // and the (possibly slow) matching is handed to the worker.
  try {
    buildRegex(pattern, flags);
  } catch (err) {
    clearResults();
    patternInput.setAttribute('aria-invalid', 'true');
    setStatus(status, err instanceof Error ? err.message : 'Invalid regular expression.', 'error');
    return;
  }

  const request: RegexRequest = {
    pattern,
    flags,
    text,
    ...(replacement === '' ? {} : { replacement }),
  };

  const active = ensureWorker();
  if (!active) {
    apply(runRegex(request));
    return;
  }
  const message: WorkerRequest = { id, ...request };
  // While the worker is still booting, hold the request instead of starting
  // the clock — the two seconds are meant to time the regex, not the download.
  if (workerReady) dispatch(active, message);
  else queued = message;
}

const runDebounced = debounce(run, 80);

// --- events ------------------------------------------------------------------

for (const el of [patternInput, replacementInput, input]) {
  el.addEventListener('input', runDebounced);
}
for (const box of flagBoxes) box.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      patternInput.value = SAMPLE.pattern;
      replacementInput.value = SAMPLE.replacement;
      input.value = SAMPLE.text;
      for (const box of flagBoxes) box.checked = SAMPLE.flags.includes(box.value);
      run();
      break;

    case 'clear':
      patternInput.value = '';
      replacementInput.value = '';
      input.value = '';
      run();
      patternInput.focus();
      break;

    case 'copy-matches': {
      const text = matchesToText(lastMatches);
      if (!text) {
        setStatus(status, 'There are no matches to copy yet.', 'error');
        return;
      }
      if (await copyText(text)) flashButton(button);
      else
        setStatus(status, 'Clipboard access was blocked — select the text and copy it.', 'error');
      break;
    }

    case 'copy-replaced': {
      if (!replaced.value) {
        setStatus(status, 'Enter a replacement first — there is nothing to copy.', 'error');
        return;
      }
      if (await copyText(replaced.value)) flashButton(button);
      else
        setStatus(status, 'Clipboard access was blocked — select the text and copy it.', 'error');
      break;
    }
  }
});

// Boot the worker up front so the first pattern is matched immediately.
ensureWorker();
run();
