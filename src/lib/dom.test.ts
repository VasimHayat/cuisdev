import { describe, expect, it } from 'vitest';

import { formatBytes } from './dom';

describe('formatBytes', () => {
  it('formats small values in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes and megabytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(15 * 1024)).toBe('15.0 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('caps at gigabytes', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3072.0 GB');
  });
});
