import { describe, expect, it } from 'vitest';

import {
  COMMON_TIME_ZONES,
  CronError,
  PRESETS,
  analyse,
  availableTimeZones,
  breakdown,
  describeCron,
  describeField,
  expandMacro,
  fieldValueLabel,
  formatInZone,
  formatRelative,
  nextRuns,
  normalizeExpression,
  splitExpression,
} from './logic';

const FROM = new Date('2026-01-01T00:00:00Z');

describe('normalizeExpression', () => {
  it('trims and collapses whitespace, including tabs and newlines', () => {
    expect(normalizeExpression('  */15   *\t*  *\n* ')).toBe('*/15 * * * *');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeExpression('   \n ')).toBe('');
  });
});

describe('expandMacro', () => {
  it('expands the standard shorthands, case-insensitively', () => {
    expect(expandMacro('@daily')).toBe('0 0 * * *');
    expect(expandMacro('@MIDNIGHT')).toBe('0 0 * * *');
    expect(expandMacro('@hourly')).toBe('0 * * * *');
    expect(expandMacro('@yearly')).toBe('0 0 1 1 *');
    expect(expandMacro('@weekly')).toBe('0 0 * * 0');
    expect(expandMacro('@monthly')).toBe('0 0 1 * *');
  });

  it('leaves ordinary expressions alone', () => {
    expect(expandMacro('*/5 * * * *')).toBe('*/5 * * * *');
  });
});

describe('splitExpression', () => {
  it('accepts 5 fields', () => {
    const { fields, specs } = splitExpression('0 9 * * 1-5');
    expect(fields).toEqual(['0', '9', '*', '*', '1-5']);
    expect(specs.map((s) => s.id)).toEqual([
      'minute',
      'hour',
      'day-of-month',
      'month',
      'day-of-week',
    ]);
  });

  it('accepts 6 fields with leading seconds', () => {
    const { specs } = splitExpression('30 0 9 * * 1-5');
    expect(specs[0]?.id).toBe('second');
    expect(specs).toHaveLength(6);
  });

  it('rejects empty input with a suggestion', () => {
    expect(() => splitExpression('  ')).toThrow(CronError);
    expect(() => splitExpression('')).toThrow(/Enter a cron expression/);
  });

  it('rejects too few and too many fields, saying how many it found', () => {
    expect(() => splitExpression('* * * *')).toThrow(/needs 5 fields[\s\S]*has 4/);
    expect(() => splitExpression('* * * * * * *')).toThrow(/at most 6 fields[\s\S]*has 7/);
  });

  it('rejects unknown @ shorthands', () => {
    expect(() => splitExpression('@fortnightly')).toThrow(/is not a supported shorthand/);
  });
});

describe('fieldValueLabel', () => {
  const dow = { id: 'day-of-week', name: 'Day of week', unit: 'day of the week', allowed: '' };
  const month = { id: 'month', name: 'Month', unit: 'month', allowed: '' };
  const hour = { id: 'hour', name: 'Hours', unit: 'hour', allowed: '' };

  it('names weekdays by number and by abbreviation, treating 7 as Sunday', () => {
    expect(fieldValueLabel('1', dow)).toBe('Monday');
    expect(fieldValueLabel('0', dow)).toBe('Sunday');
    expect(fieldValueLabel('7', dow)).toBe('Sunday');
    expect(fieldValueLabel('fri', dow)).toBe('Friday');
  });

  it('names months by number and abbreviation', () => {
    expect(fieldValueLabel('1', month)).toBe('January');
    expect(fieldValueLabel('DEC', month)).toBe('December');
  });

  it('leaves numeric fields and unknown tokens untouched', () => {
    expect(fieldValueLabel('9', hour)).toBe('9');
    expect(fieldValueLabel('L', dow)).toBe('L');
    expect(fieldValueLabel('99', month)).toBe('99');
  });
});

describe('describeField', () => {
  const minute = { id: 'minute', name: 'Minutes', unit: 'minute', allowed: '' };
  const dow = { id: 'day-of-week', name: 'Day of week', unit: 'day of the week', allowed: '' };
  const dom = { id: 'day-of-month', name: 'Day of month', unit: 'day of the month', allowed: '' };

  it('describes wildcards and steps', () => {
    expect(describeField('*', minute)).toBe('Every minute');
    expect(describeField('*/15', minute)).toBe('Every 15 minutes');
    expect(describeField('?', dom)).toBe('Every day of the month');
    expect(describeField('*/2', dom)).toBe('Every 2 days of the month');
  });

  it('describes ranges, stepped ranges and single values', () => {
    expect(describeField('1-5', dow)).toBe('Monday through Friday');
    expect(describeField('1-5/2', dow)).toBe('Every 2 days of the week from Monday through Friday');
    expect(describeField('30', minute)).toBe('30');
    expect(describeField('5/10', minute)).toBe('Every 10 minutes starting at 5');
  });

  it('joins lists with commas and "and"', () => {
    expect(describeField('0,30', minute)).toBe('0 and 30');
    expect(describeField('MON,WED,FRI', dow)).toBe('Monday, Wednesday and Friday');
  });
});

describe('breakdown', () => {
  it('returns one row per field with a meaning', () => {
    const rows = breakdown('*/15 9-17 * * 1-5');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ name: 'Minutes', value: '*/15', meaning: 'Every 15 minutes' });
    expect(rows[1]?.meaning).toBe('9 through 17');
    expect(rows[4]?.meaning).toBe('Monday through Friday');
  });

  it('includes the seconds row for 6-field expressions', () => {
    const rows = breakdown('0 */5 * * * *');
    expect(rows).toHaveLength(6);
    expect(rows[0]?.name).toBe('Seconds');
  });
});

describe('describeCron', () => {
  it('describes common expressions in plain English', () => {
    expect(describeCron('*/15 * * * *')).toBe('Every 15 minutes');
    expect(describeCron('0 0 1 * *')).toMatch(/day 1 of the month/i);
    expect(describeCron('@daily')).toMatch(/00:00/);
  });

  it('throws a CronError naming the problem', () => {
    expect(() => describeCron('99 * * * *')).toThrow(CronError);
    expect(() => describeCron('99 * * * *')).toThrow(/minutes part must be/i);
    expect(() => describeCron('99 * * * *')).toThrow(/Check the highlighted field/);
  });
});

describe('nextRuns', () => {
  it('returns the requested number of upcoming runs', () => {
    const runs = nextRuns('0 9 * * 1-5', 3, { from: FROM, timeZone: 'UTC' });
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-01-01T09:00:00.000Z',
      '2026-01-02T09:00:00.000Z',
      '2026-01-05T09:00:00.000Z',
    ]);
  });

  it('interprets the expression in the selected time zone', () => {
    const tokyo = nextRuns('0 0 * * *', 1, { from: FROM, timeZone: 'Asia/Tokyo' });
    expect(tokyo[0]?.toISOString()).toBe('2026-01-01T15:00:00.000Z');
  });

  it('supports 6-field expressions with seconds', () => {
    const runs = nextRuns('30 * * * * *', 2, { from: FROM, timeZone: 'UTC' });
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-01-01T00:00:30.000Z',
      '2026-01-01T00:01:30.000Z',
    ]);
  });

  it('rejects invalid field values', () => {
    expect(() => nextRuns('* 25 * * *', 1, { from: FROM })).toThrow(CronError);
    expect(() => nextRuns('* 25 * * *', 1, { from: FROM })).toThrow(/hour/i);
  });

  it('explains expressions that can never fire', () => {
    expect(() => nextRuns('0 0 30 2 *', 1, { from: FROM, timeZone: 'UTC' })).toThrow(/never runs/);
  });
});

describe('formatting', () => {
  it('formats an instant in a named zone', () => {
    const date = new Date('2026-01-01T09:00:00Z');
    expect(formatInZone(date, 'UTC')).toBe('2026-01-01 09:00:00');
    expect(formatInZone(date, 'Asia/Tokyo')).toBe('2026-01-01 18:00:00');
    expect(formatInZone(date, 'America/New_York')).toBe('2026-01-01 04:00:00');
  });

  it('normalises midnight to 00, not 24', () => {
    expect(formatInZone(new Date('2026-01-01T00:00:00Z'), 'UTC')).toBe('2026-01-01 00:00:00');
  });

  it('formats relative times in both directions', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(formatRelative(new Date('2026-01-01T00:15:00Z'), now)).toBe('in 15 minutes');
    expect(formatRelative(new Date('2026-01-01T02:00:00Z'), now)).toBe('in 2 hours');
    expect(formatRelative(new Date('2025-12-31T00:00:00Z'), now)).toBe('yesterday');
    expect(formatRelative(new Date('2026-01-01T00:00:30Z'), now)).toBe('in 30 seconds');
  });
});

describe('time zones', () => {
  it('filters the curated list against the runtime', () => {
    expect(availableTimeZones(['Europe/Paris'])).toEqual(['UTC', 'Europe/Paris']);
  });

  it('falls back to the whole curated list when nothing is supplied', () => {
    expect(availableTimeZones().length).toBeGreaterThan(20);
    expect(availableTimeZones()).toContain('UTC');
    expect(COMMON_TIME_ZONES).toContain('Asia/Kolkata');
  });
});

describe('analyse', () => {
  it('bundles description, breakdown and runs', () => {
    const report = analyse('0 9 * * 1-5', 2, { from: FROM, timeZone: 'UTC' });
    expect(report.expression).toBe('0 9 * * 1-5');
    expect(report.description).toMatch(/09:00/);
    expect(report.fields).toHaveLength(5);
    expect(report.runs).toHaveLength(2);
  });

  it('propagates errors as CronError', () => {
    expect(() => analyse('nope', 1, { from: FROM })).toThrow(CronError);
  });

  it('every preset parses and describes cleanly', () => {
    for (const preset of PRESETS) {
      const report = analyse(preset.expression, 1, { from: FROM, timeZone: 'UTC' });
      expect(report.description.length).toBeGreaterThan(0);
      expect(report.runs).toHaveLength(1);
    }
  });
});
