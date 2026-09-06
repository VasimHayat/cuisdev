import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'timestamp-converter',
  name: 'Unix Timestamp Converter',
  shortName: 'Timestamp',
  seoTitle: 'Unix Timestamp Converter — Epoch to Date',
  tagline: 'Convert Unix timestamps to dates and back, in any time zone, down to nanoseconds.',
  description:
    'Free online Unix timestamp converter. Turn epoch seconds, milliseconds, microseconds or nanoseconds into a readable date and back, privately in your browser.',
  category: 'web',
  icon: 'calendar-clock',
  keywords: [
    'unix timestamp converter',
    'epoch converter',
    'timestamp to date',
    'date to timestamp',
    'epoch to human readable',
    'unix time now',
    'milliseconds to date',
    'iso 8601 converter',
    'iso week number',
  ],
  intro: [
    'A Unix timestamp counts the seconds since 1 January 1970 UTC, which makes it perfect for computers and useless for humans. Paste one here and it becomes an ISO 8601 string, an RFC 2822 date, a full local date and time, a relative phrase like “in 3 hours”, plus the weekday, day of year and ISO week number — each with its own Copy button.',
    'The unit is detected from the magnitude, so 10-digit seconds, 13-digit milliseconds, 16-digit microseconds and 19-digit nanoseconds all work; you can override the guess when a value is ambiguous. Going the other way, pick a date and time or paste an ISO 8601 or RFC 2822 string and get the timestamp in seconds and milliseconds. Negative, pre-1970 and post-2038 values are all handled properly, and the live clock at the top shows the current time and epoch second by second.',
    'Everything is computed in your browser with the built-in Date and Intl APIs. Timestamps from your logs, tokens or database rows are never uploaded or stored.',
  ],
  howTo: [
    'Paste a Unix timestamp into the Unix timestamp field — the unit is detected automatically.',
    'Choose a time zone to see the date in Local time, UTC or any listed IANA zone.',
    'Read the converted formats and click Copy on the row you need.',
    'To go the other way, set the Date and time picker or paste an ISO 8601 date, and copy the Unix seconds or milliseconds.',
  ],
  example: {
    input: '1767225600',
    output: '2026-01-01T00:00:00.000Z · Thursday · day 1 of 365 · ISO week 2026-W01',
    note: 'The same instant in milliseconds is 1767225600000, and in nanoseconds 1767225600000000000.',
  },
  faq: [
    {
      question: 'How do I tell seconds from milliseconds?',
      answer:
        'By length. A current timestamp in seconds has 10 digits, milliseconds 13, microseconds 16 and nanoseconds 19. This converter picks the unit from the magnitude and tells you which one it used; if it guesses wrong, set the Unit select explicitly.',
    },
    {
      question: 'What is the Year 2038 problem?',
      answer:
        'Systems that store Unix time in a signed 32-bit integer overflow at <code>2147483647</code> — 19 January 2038 at 03:14:07 UTC — and wrap around to 1901. This tool uses 64-bit floating point dates, so it converts timestamps far beyond 2038 without a problem.',
    },
    {
      question: 'Can it handle dates before 1970?',
      answer:
        'Yes. Timestamps before the epoch are negative: <code>-86400</code> is 31 December 1969. Unix seconds are floored, so a negative millisecond value still maps to the second that contains it.',
    },
    {
      question: 'Does the converter handle time zones and daylight saving?',
      answer:
        'Yes. The Time zone select drives both directions: dates are shown in that zone, and the date-and-time picker is read as a wall clock in that zone, with the correct offset for that specific instant — so a summer date in New York uses -04:00 and a winter one -05:00.',
    },
    {
      question: 'What is an ISO week number?',
      answer:
        'ISO 8601 numbers weeks from Monday, and week 1 is the week containing the first Thursday of the year. That is why 1 January can fall in week 52 or 53 of the previous year — the ISO week row shows the correct week-numbering year, such as <code>2026-W53</code>.',
    },
    {
      question: 'Is my timestamp sent to a server?',
      answer:
        'No. All parsing and formatting happens in your browser using the standard <code>Date</code> and <code>Intl</code> APIs. Nothing is uploaded, logged or stored.',
    },
  ],
  related: ['cron-parser'],
  status: 'stable',
  added: '2026-09-07',
};
