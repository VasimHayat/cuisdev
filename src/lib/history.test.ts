import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHistory, readHistory, recentSlugs, recordVisit } from './history';

const KEY = 'cuisdev:recent';

function useMemoryStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe('history', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = useMemoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts empty', () => {
    expect(readHistory()).toEqual([]);
    expect(recentSlugs()).toEqual([]);
  });

  it('records a visit', () => {
    recordVisit('base64', 1000);
    expect(readHistory()).toEqual([{ slug: 'base64', at: 1000 }]);
  });

  it('moves a repeat visit to the front and does not duplicate it', () => {
    recordVisit('base64', 1000);
    recordVisit('json-formatter', 2000);
    recordVisit('base64', 3000);
    expect(recentSlugs()).toEqual(['base64', 'json-formatter']);
  });

  it('keeps at most eight entries, dropping the oldest', () => {
    for (let i = 0; i < 12; i++) recordVisit(`tool-${i}`, i * 1000);
    const slugs = recentSlugs();
    expect(slugs).toHaveLength(8);
    expect(slugs[0]).toBe('tool-11');
    expect(slugs).not.toContain('tool-3');
  });

  it('sorts by recency even if storage order is stale', () => {
    store.set(
      KEY,
      JSON.stringify([
        { slug: 'a', at: 1 },
        { slug: 'c', at: 3 },
        { slug: 'b', at: 2 },
      ]),
    );
    expect(recentSlugs()).toEqual(['c', 'b', 'a']);
  });

  it('can exclude the current tool', () => {
    recordVisit('a', 1);
    recordVisit('b', 2);
    expect(recentSlugs('b')).toEqual(['a']);
  });

  it('ignores malformed entries and non-array payloads', () => {
    store.set(KEY, JSON.stringify([{ slug: 'ok', at: 5 }, { slug: 42 }, null, 'x']));
    expect(recentSlugs()).toEqual(['ok']);
    store.set(KEY, JSON.stringify({ slug: 'nope' }));
    expect(readHistory()).toEqual([]);
    store.set(KEY, 'not json');
    expect(readHistory()).toEqual([]);
  });

  it('clears', () => {
    recordVisit('a', 1);
    clearHistory();
    expect(readHistory()).toEqual([]);
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readHistory()).toEqual([]);
    expect(() => recordVisit('a')).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
  });

  it('defaults the timestamp to now', () => {
    const before = Date.now();
    recordVisit('a');
    expect(readHistory()[0]?.at).toBeGreaterThanOrEqual(before);
  });
});
