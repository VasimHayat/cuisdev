import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';

import {
  type DiffCell,
  type DiffResult,
  type DiffRow,
  type DiffSegment,
  type Granularity,
  type InlineRow,
  MAX_RENDERED_ROWS,
  type RowKind,
  SAMPLE_CHANGED,
  SAMPLE_ORIGINAL,
  computeDiff,
  formatStats,
  splitLines,
  toInlineRows,
  toUnifiedDiff,
} from './logic';

type ViewMode = 'split' | 'inline';

const root = $<HTMLElement>('[data-tool="text-diff"]');
const originalInput = $<HTMLTextAreaElement>('[data-original]', root);
const changedInput = $<HTMLTextAreaElement>('[data-changed]', root);
const originalStats = $('[data-original-stats]', root);
const changedStats = $('[data-changed-stats]', root);
const view = $('[data-view]', root);
const statsLine = $('[data-stats]', root);
const status = $('[data-status]', root);
const granularitySelect = $<HTMLSelectElement>('[data-opt="granularity"]', root);
const ignoreCase = $<HTMLInputElement>('[data-opt="ignore-case"]', root);
const ignoreWhitespace = $<HTMLInputElement>('[data-opt="ignore-whitespace"]', root);
const viewInputs = $$<HTMLInputElement>('[data-view-mode] input', root);

/** Below 64em the two columns do not fit; the inline view is used instead. */
const narrow = window.matchMedia('(max-width: 63.99em)');

let lastResult: DiffResult | null = null;

function options() {
  return {
    granularity: granularitySelect.value as Granularity,
    ignoreCase: ignoreCase.checked,
    ignoreWhitespace: ignoreWhitespace.checked,
  };
}

function selectedView(): ViewMode {
  return (viewInputs.find((r) => r.checked)?.value as ViewMode | undefined) ?? 'split';
}

function effectiveView(): ViewMode {
  return narrow.matches ? 'inline' : selectedView();
}

// --- rendering --------------------------------------------------------------

function segmentNodes(segments: readonly DiffSegment[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const segment of segments) {
    if (segment.kind === 'equal') {
      fragment.append(document.createTextNode(segment.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `diff__seg diff__seg--${segment.kind}`;
    span.textContent = segment.text;
    fragment.append(span);
  }
  return fragment;
}

function numberCell(line: number | null): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'diff__num';
  cell.textContent = line === null ? '' : String(line);
  return cell;
}

/** The +/- gutter. `label` (when given) is read out instead of relying on colour. */
function signCell(sign: string, label = ''): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'diff__sign';
  if (label !== '') {
    const hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = `${label} `;
    cell.append(hidden);
  }
  cell.append(document.createTextNode(sign));
  return cell;
}

function contentCell(cell: DiffCell | null): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'diff__cell';
  const text = document.createElement('span');
  text.className = 'diff__text';
  if (cell) text.append(segmentNodes(cell.segments));
  td.append(text);
  return td;
}

function headerCell(text: string, hidden = false): HTMLTableCellElement {
  const th = document.createElement('th');
  th.scope = 'col';
  if (hidden) {
    const span = document.createElement('span');
    span.className = 'visually-hidden';
    span.textContent = text;
    th.append(span);
  } else {
    th.textContent = text;
  }
  return th;
}

function newTable(headers: HTMLTableCellElement[]): {
  table: HTMLTableElement;
  body: HTMLTableSectionElement;
} {
  const table = document.createElement('table');
  table.className = 'diff';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(...headers);
  thead.append(headRow);
  const body = document.createElement('tbody');
  table.append(thead, body);
  return { table, body };
}

const SIGNS: Record<RowKind, { left: string; right: string }> = {
  equal: { left: '', right: '' },
  added: { left: '', right: '+' },
  removed: { left: '-', right: '' },
  changed: { left: '-', right: '+' },
};

function renderSplit(rows: readonly DiffRow[]): HTMLTableElement {
  const { table, body } = newTable([
    headerCell('Original line number', true),
    headerCell('Original change marker', true),
    headerCell('Original'),
    headerCell('Changed line number', true),
    headerCell('Changed change marker', true),
    headerCell('Changed'),
  ]);
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = `diff__line diff__line--${row.kind}`;
    const marks = SIGNS[row.kind];
    tr.append(
      numberCell(row.left?.line ?? null),
      signCell(marks.left, marks.left === '' ? '' : 'Removed'),
      contentCell(row.left),
      numberCell(row.right?.line ?? null),
      signCell(marks.right, marks.right === '' ? '' : 'Added'),
      contentCell(row.right),
    );
    fragment.append(tr);
  }

  body.append(fragment);
  return table;
}

function renderInline(rows: readonly InlineRow[]): HTMLTableElement {
  const { table, body } = newTable([
    headerCell('Original line number', true),
    headerCell('Changed line number', true),
    headerCell('Change marker', true),
    headerCell('Line'),
  ]);
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = `diff__line diff__line--${row.kind}`;
    const label = row.kind === 'added' ? 'Added' : row.kind === 'removed' ? 'Removed' : '';
    tr.append(
      numberCell(row.oldLine),
      numberCell(row.newLine),
      signCell(row.sign.trim(), label),
      contentCell({ line: 0, text: row.text, segments: row.segments }),
    );
    fragment.append(tr);
  }

  body.append(fragment);
  return table;
}

function message(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'tool-text-diff__empty';
  p.textContent = text;
  return p;
}

function notice(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'tool-text-diff__notice';
  p.textContent = text;
  return p;
}

function paint(nodes: Node[]): void {
  view.replaceChildren(...nodes);
}

// --- run --------------------------------------------------------------------

function lineCount(text: string): string {
  const count = splitLines(text).length;
  return `${count.toLocaleString('en-US')} line${count === 1 ? '' : 's'}`;
}

function run(): void {
  originalStats.textContent = lineCount(originalInput.value);
  changedStats.textContent = lineCount(changedInput.value);

  if (originalInput.value === '' && changedInput.value === '') {
    lastResult = null;
    paint([
      message('Paste or type both versions above — the differences appear here as you type.'),
    ]);
    statsLine.textContent = '0 additions · 0 deletions · 0 unchanged lines';
    setStatus(status, '');
    return;
  }

  let result: DiffResult;
  try {
    result = computeDiff(originalInput.value, changedInput.value, options());
  } catch (err) {
    lastResult = null;
    paint([message('No comparison — see the message below.')]);
    statsLine.textContent = '0 additions · 0 deletions · 0 unchanged lines';
    setStatus(status, err instanceof Error ? err.message : 'Could not compare the two texts.', 'error'); // prettier-ignore
    return;
  }

  lastResult = result;
  statsLine.textContent = formatStats(result.stats);

  if (result.identical) {
    paint([message('The two texts are identical.')]);
    setStatus(status, 'No differences found.', 'success');
    return;
  }

  const inline = effectiveView() === 'inline';
  const total = inline ? result.ops.length : result.rows.length;
  const capped = total > MAX_RENDERED_ROWS;
  const nodes: Node[] = [];

  if (inline) {
    const rows = toInlineRows(result.ops, options());
    nodes.push(renderInline(capped ? rows.slice(0, MAX_RENDERED_ROWS) : rows));
  } else {
    const rows = result.rows;
    nodes.push(renderSplit(capped ? rows.slice(0, MAX_RENDERED_ROWS) : rows));
  }
  if (capped) {
    nodes.push(
      notice(
        `Showing the first ${MAX_RENDERED_ROWS.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} rows. Copy or download the diff for the whole result.`,
      ),
    );
  }
  paint(nodes);

  const messages: string[] = [];
  if (result.approximate) {
    messages.push(
      'The two texts are too different to align line by line, so every line is shown as removed then added.',
    );
  }
  if (narrow.matches && selectedView() === 'split') {
    messages.push('Side by side is shown as one column on this screen width.');
  }
  setStatus(status, messages.join(' '), result.approximate ? 'error' : 'info');
}

const runDebounced = debounce(run, 80);

function unifiedDiff(): string {
  return toUnifiedDiff(originalInput.value, changedInput.value, options());
}

// --- events -----------------------------------------------------------------

originalInput.addEventListener('input', runDebounced);
changedInput.addEventListener('input', runDebounced);
granularitySelect.addEventListener('change', run);
ignoreCase.addEventListener('change', run);
ignoreWhitespace.addEventListener('change', run);
for (const radio of viewInputs) radio.addEventListener('change', run);
narrow.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      originalInput.value = SAMPLE_ORIGINAL;
      changedInput.value = SAMPLE_CHANGED;
      run();
      break;

    case 'clear':
      originalInput.value = '';
      changedInput.value = '';
      run();
      originalInput.focus();
      break;

    case 'swap': {
      const previous = originalInput.value;
      originalInput.value = changedInput.value;
      changedInput.value = previous;
      run();
      break;
    }

    case 'copy': {
      if (!lastResult || lastResult.identical) {
        setStatus(status, 'There is nothing to copy — the two texts are the same.', 'error');
        return;
      }
      const ok = await copyText(unifiedDiff());
      if (ok) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — use Download instead.', 'error');
      break;
    }

    case 'download': {
      if (!lastResult || lastResult.identical) {
        setStatus(status, 'There is nothing to download — the two texts are the same.', 'error');
        return;
      }
      downloadText(unifiedDiff(), 'changes.diff', 'text/x-diff');
      break;
    }
  }
});

run();
