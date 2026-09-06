import { $, $$, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import { type CaseId, SAMPLE, convertAll, formatAll, splitWords } from './logic';

/** Only this much of each result is painted; Copy always uses the full text. */
const MAX_PREVIEW_CHARS = 5_000;

const root = $<HTMLElement>('[data-tool="case-converter"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const inputStats = $('[data-input-stats]', root);
const status = $('[data-status]', root);
const cells = new Map<CaseId, HTMLOutputElement>(
  $$<HTMLOutputElement>('[data-value]', root).map((el) => [el.dataset.value as CaseId, el]),
);

/** Full (untruncated) result per case, kept for the Copy buttons. */
const values = new Map<CaseId, string>();

function run(): void {
  const text = input.value;
  const words = splitWords(text).length;
  inputStats.textContent = `${text.length.toLocaleString('en-US')} characters · ${words.toLocaleString('en-US')} word${words === 1 ? '' : 's'}`;

  let truncated = false;
  try {
    values.clear();
    for (const result of convertAll(text)) {
      values.set(result.id, result.value);
      const cell = cells.get(result.id);
      if (!cell) continue;
      if (result.value.length > MAX_PREVIEW_CHARS) {
        truncated = true;
        cell.textContent = `${result.value.slice(0, MAX_PREVIEW_CHARS)}…`;
      } else {
        cell.textContent = result.value;
      }
    }
  } catch (err) {
    values.clear();
    for (const cell of cells.values()) cell.textContent = '';
    setStatus(status, err instanceof Error ? err.message : 'Could not convert this text.', 'error');
    return;
  }

  setStatus(
    status,
    truncated
      ? `Each result is previewed to its first ${MAX_PREVIEW_CHARS.toLocaleString('en-US')} characters. Copy copies the whole thing.`
      : '',
  );
}

const runDebounced = debounce(run, 60);

input.addEventListener('input', runDebounced);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.value = SAMPLE;
      run();
      input.focus();
      break;

    case 'clear':
      input.value = '';
      run();
      input.focus();
      break;

    case 'copy-row': {
      const id = button.dataset.case as CaseId | undefined;
      const value = id ? values.get(id) : undefined;
      if (!value) {
        setStatus(status, 'There is nothing to copy yet — type or paste some text first.', 'error');
        return;
      }
      if (await copyText(value)) flashButton(button);
      else setStatus(status, 'Clipboard access was blocked — select the text and copy manually.', 'error'); // prettier-ignore
      break;
    }

    case 'copy-all': {
      if (input.value === '') {
        setStatus(status, 'There is nothing to copy yet — type or paste some text first.', 'error');
        return;
      }
      if (await copyText(formatAll(input.value))) flashButton(button, 'Copied!');
      else setStatus(status, 'Clipboard access was blocked — select the text and copy manually.', 'error'); // prettier-ignore
      break;
    }
  }
});

run();
