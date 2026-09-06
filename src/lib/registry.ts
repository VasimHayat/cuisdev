/**
 * Tool registry. Auto-discovers every `src/tools/<slug>/meta.ts` at build time
 * and validates it, so adding a tool never requires touching a central list.
 */
import {
  TOOL_CATEGORY_IDS,
  type ToolCategory,
  type ToolCategoryId,
  type ToolMeta,
} from '@/tools/_types';

export const categories: readonly ToolCategory[] = [
  {
    id: 'json',
    name: 'JSON & Data',
    shortName: 'JSON',
    description: 'Format, validate, convert and query JSON, YAML, CSV and XML.',
    icon: 'braces',
  },
  {
    id: 'encoding',
    name: 'Encode & Decode',
    shortName: 'Encoding',
    description: 'Base64, URL, HTML entities, JWT and string escaping.',
    icon: 'binary',
  },
  {
    id: 'generators',
    name: 'Generators',
    shortName: 'Generators',
    description: 'UUIDs, hashes, passwords, placeholder text and QR codes.',
    icon: 'sparkles',
  },
  {
    id: 'text',
    name: 'Text',
    shortName: 'Text',
    description: 'Diff, transform, count and test text and regular expressions.',
    icon: 'text',
  },
  {
    id: 'web',
    name: 'Web & Code',
    shortName: 'Web',
    description: 'Minify, beautify, colours, cron, timestamps and number bases.',
    icon: 'code',
  },
  {
    id: 'images',
    name: 'Images',
    shortName: 'Images',
    description: 'Compress, convert and resize images without uploading them.',
    icon: 'image',
  },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const metaModules = import.meta.glob<{ meta: ToolMeta }>('../tools/*/meta.ts', { eager: true });

function validate(path: string, meta: ToolMeta): ToolMeta {
  const folder = path.split('/').at(-2);
  const problems: string[] = [];

  if (!SLUG_PATTERN.test(meta.slug)) problems.push(`slug "${meta.slug}" must be kebab-case`);
  if (meta.slug !== folder) problems.push(`slug "${meta.slug}" must match folder "${folder}"`);
  if (!TOOL_CATEGORY_IDS.includes(meta.category))
    problems.push(`unknown category "${meta.category}"`);
  if (meta.description.length < 110 || meta.description.length > 160)
    problems.push(`description is ${meta.description.length} chars (want 110–160)`);
  if (meta.seoTitle.length > 50)
    problems.push(`seoTitle is ${meta.seoTitle.length} chars (max 50)`);
  if (meta.tagline.length > 100) problems.push(`tagline is ${meta.tagline.length} chars (max 100)`);
  if (meta.howTo.length < 2) problems.push('howTo needs at least 2 steps');
  if (meta.faq.length < 3) problems.push('faq needs at least 3 entries');
  if (Number.isNaN(Date.parse(meta.added))) problems.push(`added "${meta.added}" is not a date`);

  if (problems.length > 0) {
    throw new Error(`Invalid tool meta in ${path}:\n  - ${problems.join('\n  - ')}`);
  }
  return meta;
}

export const tools: readonly ToolMeta[] = Object.entries(metaModules)
  .map(([path, mod]) => validate(path, mod.meta))
  .sort((a, b) => a.name.localeCompare(b.name));

{
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.slug)) throw new Error(`Duplicate tool slug "${tool.slug}"`);
    seen.add(tool.slug);
  }
  for (const tool of tools) {
    for (const rel of tool.related ?? []) {
      if (!seen.has(rel)) throw new Error(`Tool "${tool.slug}" relates to unknown tool "${rel}"`);
    }
  }
}

export const toolUrl = (slug: string): string => `/tools/${slug}/`;
export const categoryUrl = (id: ToolCategoryId): string => `/tools/category/${id}/`;

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getCategory(id: ToolCategoryId): ToolCategory {
  const category = categories.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown category "${id}"`);
  return category;
}

export function getToolsByCategory(id: ToolCategoryId): ToolMeta[] {
  return tools.filter((t) => t.category === id);
}

/** Categories that currently have at least one tool, in display order. */
export function getPopulatedCategories(): ToolCategory[] {
  return categories.filter((c) => tools.some((t) => t.category === c.id));
}

/** Hand-picked related tools first, then the rest of the category, capped. */
export function getRelatedTools(tool: ToolMeta, limit = 6): ToolMeta[] {
  const picked = (tool.related ?? [])
    .map((slug) => getTool(slug))
    .filter((t): t is ToolMeta => t !== undefined);
  const sameCategory = getToolsByCategory(tool.category).filter(
    (t) => t.slug !== tool.slug && !picked.includes(t),
  );
  return [...picked, ...sameCategory].slice(0, limit);
}

/** Compact index consumed by the command palette. */
export interface SearchEntry {
  slug: string;
  name: string;
  tagline: string;
  category: ToolCategoryId;
  categoryName: string;
  keywords: string[];
  icon: ToolMeta['icon'];
  url: string;
}

export function getSearchIndex(): SearchEntry[] {
  return tools.map((t) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    category: t.category,
    categoryName: getCategory(t.category).shortName,
    keywords: t.keywords,
    icon: t.icon,
    url: toolUrl(t.slug),
  }));
}
