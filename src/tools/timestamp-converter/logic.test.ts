import { describe, expect, it } from 'vitest';

import {
  MAX_TIME_MS,
  TimestampError,
  cleanNumericInput,
  dayOfYear,
  daysInYear,
  describeDate,
  describeTimestamp,
  detectUnit,
  formatLocal,
  formatOffset,
  isoWeek,
  msToZonedInput,
  parseDateText,
  parseTimestamp,
  relativeTime,
  timeZoneOffsetMs,
  toIsoUtc,
  toIsoWithOffset,
  toRfc2822,
  unixSeconds,
  weekdayName,
  zonedInputToMs,
} from './logic';

/** 2026-01-01T00:00:00Z */
const NEW_YEAR = 1_767_225_600_000;
const NOW = new Date('2026-01-01T00:00:00Z');

describe('cleanNumericInput', () => {
  it('strips spaces, underscores and thousands separators', () => {
    expect(cleanNumericInput('  1_767_225_600 ')).toBe('1767225600');
    expect(cleanNumericInput('1,767,225,600')).toBe('1767225600');
  });
});

describe('detectUnit', () => {
  it('reads magnitudes as seconds, milliseconds, microseconds and nanoseconds', () => {
    expect(detectUnit(1_767_225_600)).toBe('seconds');
    expect(detectUnit(1_767_225_600_000)).toBe('milliseconds');
    expect(detectUnit(1_767_225_600_000_000)).toBe('microseconds');
    expect(detectUnit(1_767_225_600_000_000_000)).toBe('nanoseconds');
  });

  it('treats 0 and small values as seconds, and ignores the sign', () => {
    expect(detectUnit(0)).toBe('seconds');
    expect(detectUnit(-1_767_225_600)).toBe('seconds');
    expect(detectUnit(-1_767_225_600_000)).toBe('milliseconds');
  });
});

describe('parseTimestamp', () => {
  it('auto-detects seconds and milliseconds', () => {
    expect(parseTimestamp('1767225600')).toMatchObject({
      ms: NEW_YEAR,
      unit: 'seconds',
      detected: true,
    });
    expect(parseTimestamp('1767225600000').ms).toBe(NEW_YEAR);
    expect(parseTimestamp('1767225600000000').ms).toBe(NEW_YEAR);
    expect(parseTimestamp('1767225600000000000').ms).toBe(NEW_YEAR);
  });

  it('honours an explicit unit override', () => {
    expect(parseTimestamp('1767225600', 'milliseconds')).toMatchObject({
      ms: 1_767_225_600,
      unit: 'milliseconds',
      detected: false,
    });
  });

  it('accepts negative (pre-1970) timestamps', () => {
    expect(parseTimestamp('-86400').ms).toBe(-86_400_000);
    expect(toIsoUtc(parseTimestamp('-86400').ms)).toBe('1969-12-31T00:00:00.000Z');
  });

  it('accepts the Y2038 boundary and beyond', () => {
    expect(toIsoUtc(parseTimestamp('2147483647').ms)).toBe('2038-01-19T03:14:07.000Z');
    expect(toIsoUtc(parseTimestamp('2147483648').ms)).toBe('2038-01-19T03:14:08.000Z');
  });

  it('rejects empty and non-numeric input with guidance', () => {
    expect(() => parseTimestamp('   ')).toThrow(TimestampError);
    expect(() => parseTimestamp('')).toThrow(/Enter a Unix timestamp/);
    expect(() => parseTimestamp('yesterday')).toThrow(/is not a number/);
    expect(() => parseTimestamp('12ab')).toThrow(TimestampError);
  });

  it('rejects values outside the representable range', () => {
    expect(() => parseTimestamp(String(MAX_TIME_MS + 1), 'milliseconds')).toThrow(
      /outside the range/,
    );
    expect(() => parseTimestamp('99999999999999999999', 'seconds')).toThrow(TimestampError);
  });
});

describe('time zone maths', () => {
  it('computes fixed and half-hour offsets', () => {
    expect(timeZoneOffsetMs('UTC', new Date(NEW_YEAR))).toBe(0);
    expect(timeZoneOffsetMs('Asia/Kolkata', new Date(NEW_YEAR))).toBe(19_800_000);
  });

  it('follows daylight saving changes', () => {
    expect(timeZoneOffsetMs('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(
      -18_000_000,
    );
    expect(timeZoneOffsetMs('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(
      -14_400_000,
    );
  });

  it('formats offsets', () => {
    expect(formatOffset(0)).toBe('Z');
    expect(formatOffset(19_800_000)).toBe('+05:30');
    expect(formatOffset(-18_000_000)).toBe('-05:00');
  });
});

describe('formatting', () => {
  it('formats ISO in UTC and in a zone', () => {
    expect(toIsoUtc(NEW_YEAR)).toBe('2026-01-01T00:00:00.000Z');
    expect(toIsoWithOffset(NEW_YEAR, 'UTC')).toBe('2026-01-01T00:00:00Z');
    expect(toIsoWithOffset(NEW_YEAR, 'Asia/Kolkata')).toBe('2026-01-01T05:30:00+05:30');
    expect(toIsoWithOffset(NEW_YEAR, 'America/New_York')).toBe('2025-12-31T19:00:00-05:00');
  });

  it('formats RFC 2822', () => {
    expect(toRfc2822(NEW_YEAR)).toBe('Thu, 01 Jan 2026 00:00:00 GMT');
    expect(toRfc2822(0)).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
  });

  it('formats a full local date', () => {
    expect(formatLocal(NEW_YEAR, 'UTC', 'en-GB')).toMatch(/Thursday.*2026.*00:00:00/);
  });

  it('formats relative times in both directions', () => {
    expect(relativeTime(NEW_YEAR + 3_600_000, NOW)).toBe('in 1 hour');
    expect(relativeTime(NEW_YEAR - 2 * 86_400_000, NOW)).toBe('2 days ago');
    expect(relativeTime(NEW_YEAR, NOW)).toBe('now');
  });
});

describe('calendar helpers', () => {
  it('reports the weekday in the selected zone', () => {
    expect(weekdayName(NEW_YEAR, 'UTC')).toBe('Thursday');
    // 00:00 UTC is still 31 December in New York.
    expect(weekdayName(NEW_YEAR, 'America/New_York')).toBe('Wednesday');
  });

  it('counts the day of the year and the year length', () => {
    expect(dayOfYear(NEW_YEAR, 'UTC')).toBe(1);
    expect(dayOfYear(Date.parse('2026-12-31T12:00:00Z'), 'UTC')).toBe(365);
    expect(daysInYear(NEW_YEAR, 'UTC')).toBe(365);
    expect(daysInYear(Date.parse('2024-05-01T00:00:00Z'), 'UTC')).toBe(366);
    expect(daysInYear(Date.parse('2000-05-01T00:00:00Z'), 'UTC')).toBe(366);
    expect(daysInYear(Date.parse('1900-05-01T00:00:00Z'), 'UTC')).toBe(365);
  });

  it('computes ISO week numbers, including the year boundary', () => {
    expect(isoWeek(NEW_YEAR, 'UTC')).toEqual({ year: 2026, week: 1 });
    // 1 January 2027 is a Friday, so it belongs to week 53 of 2026.
    expect(isoWeek(Date.parse('2027-01-01T12:00:00Z'), 'UTC')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(Date.parse('2026-12-31T12:00:00Z'), 'UTC')).toEqual({ year: 2026, week: 53 });
  });
});

describe('describeTimestamp', () => {
  it('returns every row in display order', () => {
    const rows = describeTimestamp(NEW_YEAR, { timeZone: 'UTC', now: NOW });
    expect(rows.map((r) => r.id)).toEqual([
      'iso',
      'iso-offset',
      'rfc',
      'local',
      'relative',
      'weekday',
      'day-of-year',
      'iso-week',
      'seconds',
      'milliseconds',
    ]);
    expect(rows.find((r) => r.id === 'iso-week')?.value).toBe('2026-W01');
    expect(rows.find((r) => r.id === 'day-of-year')?.value).toBe('1 of 365');
    expect(rows.find((r) => r.id === 'seconds')?.value).toBe('1767225600');
    expect(rows.find((r) => r.id === 'milliseconds')?.value).toBe('1767225600000');
  });

  it('leaves the relative row blank when no clock is supplied', () => {
    const rows = describeTimestamp(NEW_YEAR, { timeZone: 'UTC' });
    expect(rows.find((r) => r.id === 'relative')?.value).toBe('—');
  });

  it('floors Unix seconds for pre-1970 instants', () => {
    expect(unixSeconds(-1500)).toBe(-2);
    expect(
      describeTimestamp(-1500, { timeZone: 'UTC' }).find((r) => r.id === 'seconds')?.value,
    ).toBe('-2');
  });
});

describe('parseDateText', () => {
  it('parses ISO 8601 and RFC 2822', () => {
    expect(parseDateText('2026-01-01T00:00:00Z')).toBe(NEW_YEAR);
    expect(parseDateText('  Thu, 01 Jan 2026 00:00:00 GMT ')).toBe(NEW_YEAR);
  });

  it('rejects empty and unparseable text', () => {
    expect(() => parseDateText('  ')).toThrow(/Enter a date/);
    expect(() => parseDateText('next tuesday')).toThrow(/could not be read as a date/);
  });
});

describe('datetime-local round trip', () => {
  it('reads a naive value in the selected zone', () => {
    expect(zonedInputToMs('2026-01-01T00:00', 'UTC')).toBe(NEW_YEAR);
    expect(zonedInputToMs('2026-01-01T05:30', 'Asia/Kolkata')).toBe(NEW_YEAR);
    expect(zonedInputToMs('2025-12-31T19:00:00', 'America/New_York')).toBe(NEW_YEAR);
  });

  it('handles a summer-time instant correctly', () => {
    expect(zonedInputToMs('2026-07-01T12:00', 'America/New_York')).toBe(
      Date.parse('2026-07-01T16:00:00Z'),
    );
  });

  it('round-trips through msToZonedInput', () => {
    expect(msToZonedInput(NEW_YEAR, 'UTC')).toBe('2026-01-01T00:00:00');
    expect(msToZonedInput(NEW_YEAR, 'Asia/Kolkata')).toBe('2026-01-01T05:30:00');
    expect(zonedInputToMs(msToZonedInput(NEW_YEAR, 'Asia/Tokyo'), 'Asia/Tokyo')).toBe(NEW_YEAR);
  });

  it('rejects empty and malformed values', () => {
    expect(() => zonedInputToMs('', 'UTC')).toThrow(/Pick a date and time/);
    expect(() => zonedInputToMs('01/01/2026', 'UTC')).toThrow(/is not a date and time/);
  });
});

describe('describeDate', () => {
  it('returns seconds and milliseconds rows', () => {
    expect(describeDate(NEW_YEAR)).toEqual([
      { id: 'to-seconds', label: 'Unix seconds', value: '1767225600' },
      { id: 'to-milliseconds', label: 'Unix milliseconds', value: '1767225600000' },
    ]);
  });
});
