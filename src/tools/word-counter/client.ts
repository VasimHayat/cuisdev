import { $, $$, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';

import {
  LIMITS,
  SAMPLE,
  SPEAKING_WPM,
  type TextStats,
  analyze,
  formatDuration,
  formatStatsText,
  limitStatus,
} from './logic';

const root = $<HTMLElement>('[data-tool="word-counter"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const status = $('[data-status]', root);
const wpmInput = $<HTMLInputElement>('[data-opt="wpm"]', root);
const stopWords = $<HTMLInputElement>('[data-opt="stop-words"]', root);
const readingLabel = $('[data-reading-label]', root);
const statCells = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-stat]', root).map((el) => [el.dataset.stat ?? '', el]),
);
const limitCells = new Map<string, HTMLElement>(
  $$<HTMLElement>('[data-limit]', root).map((el) => [el.dataset.limit ?? '', el]),
);
const topRows = $$<HTMLTableRowElement>('[data-top-row]', root);

let lastStats: TextStats | null = null;

const number = (value: number) => value.toLocaleString('en-US');

function setStat(key: string, value: string): void {
  const cell = statCells.get(key);
  if (cell) cell.textContent = value;
}

function setTopRow(row: HTMLTableRowElement, word: string, count: string, percent: string): void {
  const wordCell = row.querySelector<HTMLElement>('[data-top-word]');
  const countCell = row.querySelector<HTMLElement>('[data-top-count]');
  const percentCell = row.querySelector<HTMLElement>('[data-top-percent]');
  if (wordCell) wordCell.textContent = word;
  if (countCell) countCell.textContent = count;
  if (percentCell) percentCell.textContent = percent;
}

function renderStats(stats: TextStats): void {
  setStat('words', number(stats.words));
  setStat('characters', number(stats.characters));
  setStat('charactersNoSpaces', number(stats.charactersNoSpaces));
  setStat('uniqueWords', number(stats.uniqueWords));
  setStat('sentences', number(stats.sentences));
  setStat('paragraphs', number(stats.paragraphs));
  setStat('lines', number(stats.lines));
  setStat('averageWordLength', String(stats.averageWordLength));
  setStat('longestWord', stats.longestWord === '' ? '—' : stats.longestWord);
  setStat('readingSeconds', formatDuration(stats.readingSeconds));
  setStat('speakingSeconds', formatDuration(stats.speakingSeconds));
  setStat('bytes', `${number(stats.bytes)} bytes · ${formatBytes(stats.bytes)}`);
  readingLabel.textContent = `Reading time (${stats.readingWpm} wpm)`;

  for (const limit of LIMITS) {
    const cell = limitCells.get(limit.id);
    if (!cell) continue;
    const result = limitStatus(stats.characters, limit.max);
    cell.textContent = result.over
      ? `${number(Math.abs(result.remaining))} over`
      : `${number(result.remaining)} left`;
    cell.dataset.over = result.over ? 'true' : 'false';
  }

  topRows.forEach((row, index) => {
    const entry = stats.top[index];
    if (entry) setTopRow(row, entry.word, number(entry.count), `${entry.percent}%`);
    else setTopRow(row, '—', '', '');
  });
}

function blankStats(): void {
  for (const cell of statCells.values()) cell.textContent = '—';
  for (const cell of limitCells.values()) {
    cell.textContent = '—';
    cell.dataset.over = 'false';
  }
  for (const row of topRows) setTopRow(row, '—', '', '');
}

function run(): void {
  try {
    const stats = analyze(input.value, {
      readingWpm: Number(wpmInput.value),
      speakingWpm: SPEAKING_WPM,
      excludeStopWords: stopWords.checked,
    });
    lastStats = stats;
    wpmInput.removeAttribute('aria-invalid');
    renderStats(stats);
    setStatus(status, '');
  } catch (err) {
    const problem = err instanceof Error ? err.message : 'Could not count this text.';
    lastStats = null;
    blankStats();
    if (problem.startsWith('Reading speed')) wpmInput.setAttribute('aria-invalid', 'true');
    setStatus(status, problem, 'error');
  }
}

const runDebounced = debounce(run, 80);

input.addEventListener('input', runDebounced);
wpmInput.addEventListener('input', runDebounced);
stopWords.addEventListener('change', run);

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

    case 'copy-stats': {
      if (!lastStats) {
        setStatus(status, 'There are no statistics to copy — fix the options first.', 'error');
        return;
      }
      if (await copyText(formatStatsText(lastStats))) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the statistics and copy manually.',
          'error',
        );
      break;
    }
  }
});

run();
