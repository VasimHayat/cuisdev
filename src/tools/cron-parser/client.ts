import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import {
  CronError,
  type FieldBreakdown,
  SAMPLE_EXPRESSION,
  analyse,
  formatInZone,
  formatRelative,
  normalizeExpression,
} from './logic';

const EMPTY = '—';

const root = $<HTMLElement>('[data-tool="cron-parser"]');
const input = $<HTMLInputElement>('[data-input]', root);
const zoneSelect = $<HTMLSelectElement>('[data-timezone]', root);
const description = $('[data-description]', root);
const fieldsBody = $('[data-fields]', root);
const runsBody = $('[data-runs]', root);
const zoneHeading = $('[data-zone-heading]', root);
const status = $('[data-status]', root);

const runRows = $$<HTMLTableRowElement>('tr', runsBody);

/** The runs currently shown, for Copy next runs. */
let currentRuns: Date[] = [];

const localZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'local time';
  }
};

function zoneLabel(): string {
  return zoneSelect.value === 'local' ? `Local (${localZone()})` : zoneSelect.value;
}

function renderFields(fields: FieldBreakdown[] | null): void {
  fieldsBody.replaceChildren();
  if (!fields) return;
  for (const field of fields) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = field.name;
    const value = document.createElement('td');
    value.className = 'tool-cron-parser__mono';
    value.textContent = field.value;
    const meaning = document.createElement('td');
    meaning.textContent = field.meaning;
    const allowed = document.createElement('td');
    allowed.className = 'tool-cron-parser__allowed';
    allowed.textContent = field.allowed;
    row.append(name, value, meaning, allowed);
    fieldsBody.append(row);
  }
}

function renderRuns(runs: Date[] | null): void {
  currentRuns = runs ?? [];
  const zone = zoneSelect.value;
  const now = new Date();
  runRows.forEach((row, index) => {
    const run = runs?.[index];
    const zoneCell = row.querySelector<HTMLElement>('[data-run-zone]');
    const utcCell = row.querySelector<HTMLElement>('[data-run-utc]');
    const relativeCell = row.querySelector<HTMLElement>('[data-run-relative]');
    if (zoneCell) zoneCell.textContent = run ? formatInZone(run, zone) : EMPTY;
    if (utcCell) utcCell.textContent = run ? formatInZone(run, 'UTC') : EMPTY;
    if (relativeCell) relativeCell.textContent = run ? formatRelative(run, now) : EMPTY;
  });
}

function run(): void {
  zoneHeading.textContent = zoneLabel();
  try {
    const report = analyse(input.value, runRows.length, { timeZone: zoneSelect.value });
    input.removeAttribute('aria-invalid');
    description.textContent = report.description;
    renderFields(report.fields);
    renderRuns(report.runs);
    setStatus(status, '');
  } catch (err) {
    input.setAttribute('aria-invalid', 'true');
    description.textContent = EMPTY;
    renderFields(null);
    renderRuns(null);
    setStatus(
      status,
      err instanceof CronError ? err.message : 'Could not read that cron expression.',
      'error',
    );
  }
}

function runsAsText(): string {
  const zone = zoneSelect.value === 'local' ? localZone() : zoneSelect.value;
  return currentRuns
    .map((date, index) => `${index + 1}. ${formatInZone(date, zoneSelect.value)} ${zone}`)
    .join('\n');
}

// --- events -----------------------------------------------------------------

input.addEventListener('input', debounce(run, 80));
zoneSelect.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'preset':
      input.value = button.dataset.expression ?? SAMPLE_EXPRESSION;
      run();
      break;

    case 'clear':
      input.value = '';
      run();
      input.focus();
      break;

    case 'copy-expression': {
      const expression = normalizeExpression(input.value);
      if (expression === '') return;
      if (await copyText(expression)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the text manually.', 'error');
      break;
    }

    case 'copy-runs': {
      const text = runsAsText();
      if (text === '') return;
      if (await copyText(text)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — copy the text manually.', 'error');
      break;
    }
  }
});

// Label the "Local time" option with the zone the browser actually resolved.
const localOption = zoneSelect.querySelector<HTMLOptionElement>('option[value="local"]');
if (localOption) localOption.textContent = `Local time (${localZone()})`;

run();
