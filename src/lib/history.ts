/**
 * Recently used tools. Stored in this browser only — never sent anywhere and
 * never synced. Any storage failure (private mode, blocked site data) is
 * treated as "no history" rather than an error.
 */
const KEY = 'cuisdev:recent';
const LIMIT = 8;

export interface Visit {
  slug: string;
  /** Epoch milliseconds of the most recent visit. */
  at: number;
}

export function readHistory(): Visit[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is Visit =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as Visit).slug === 'string' &&
          typeof (v as Visit).at === 'number',
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

/** Record a visit, moving the tool to the front of the list. */
export function recordVisit(slug: string, now = Date.now()): Visit[] {
  const next = [{ slug, at: now }, ...readHistory().filter((v) => v.slug !== slug)].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — history is a convenience, not a requirement */
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Slugs of recently used tools, most recent first, excluding `exclude`. */
export function recentSlugs(exclude?: string): string[] {
  return readHistory()
    .map((v) => v.slug)
    .filter((slug) => slug !== exclude);
}
