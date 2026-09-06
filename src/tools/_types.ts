import type { IconName } from '@/components/icons';

export const TOOL_CATEGORY_IDS = [
  'json',
  'encoding',
  'generators',
  'text',
  'web',
  'images',
] as const;
export type ToolCategoryId = (typeof TOOL_CATEGORY_IDS)[number];

export interface ToolCategory {
  id: ToolCategoryId;
  name: string;
  /** Short label used in navigation and badges. */
  shortName: string;
  description: string;
  icon: IconName;
}

export interface ToolFaq {
  question: string;
  /** Plain text or simple inline HTML (<code>, <a>, <strong>). */
  answer: string;
}

export interface ToolExample {
  input: string;
  output: string;
  note?: string;
}

/**
 * Everything the site needs to know about a tool, in one place.
 * `src/tools/<slug>/meta.ts` must export this as `meta`.
 */
export interface ToolMeta {
  /** URL segment: /tools/<slug>/ — must equal the folder name. */
  slug: string;
  /** Display name, e.g. "Base64 Encoder / Decoder". */
  name: string;
  /** Short name for tight spaces (cards, palette). Defaults to `name`. */
  shortName?: string;
  /** One line under the H1 (max ~90 chars). */
  tagline: string;
  /** <meta name="description"> — 140–155 chars, contains the primary keyword. */
  description: string;
  /** Primary keyword phrase used in the <title>. e.g. "Base64 Encode & Decode Online". */
  seoTitle: string;
  category: ToolCategoryId;
  keywords: string[];
  icon: IconName;
  /** Intro paragraph(s) for the content section. Plain text; each item becomes a <p>. */
  intro: string[];
  /** Ordered how-to steps (HowTo schema). */
  howTo: string[];
  example?: ToolExample;
  faq: ToolFaq[];
  /** Slugs of hand-picked related tools. Same-category tools are added automatically. */
  related?: string[];
  status?: 'stable' | 'beta';
  /** ISO dates — surfaced as dateCreated/dateModified. */
  added: string;
  updated?: string;
}
