/**
 * JSON-LD builders. Every page passes an array of these to <BaseLayout>.
 * https://schema.org — validated with https://validator.schema.org
 */
import { site } from '@/lib/site';
import type { ToolMeta } from '@/tools/_types';

import { categoryUrl, getCategory, toolUrl } from './registry';

export type JsonLd = Record<string, unknown>;

export const absolute = (path: string): string => new URL(path, site.url).href;

export function pageTitle(title?: string): string {
  if (!title) return site.title;
  return `${title} | ${site.name}`;
}

export function organization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: absolute('/icons/icon-512.png'),
    ...(site.github ? { sameAs: [site.github] } : {}),
  };
}

export function website(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: site.language,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site.url}/tools/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbs(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absolute(c.href),
    })),
  };
}

export function toolCrumbs(tool: ToolMeta): Crumb[] {
  const category = getCategory(tool.category);
  return [
    { name: 'Home', href: '/' },
    { name: 'Tools', href: '/tools/' },
    { name: category.shortName, href: categoryUrl(category.id) },
    { name: tool.shortName ?? tool.name, href: toolUrl(tool.slug) },
  ];
}

/** An ordered list of tools, for the /tools/ index and category hubs. */
export function toolItemList(list: readonly ToolMeta[], name: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: list.length,
    itemListElement: list.map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      description: tool.tagline,
      url: absolute(toolUrl(tool.slug)),
    })),
  };
}

export function collectionPage(name: string, description: string, path: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absolute(path),
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
    inLanguage: site.language,
  };
}

export function softwareApplication(tool: ToolMeta): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    url: absolute(toolUrl(tool.slug)),
    description: tool.description,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: getCategory(tool.category).name,
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    keywords: tool.keywords.join(', '),
    dateCreated: tool.added,
    dateModified: tool.updated ?? tool.added,
    inLanguage: site.language,
    publisher: { '@type': 'Organization', name: site.name, url: site.url },
  };
}

export function faqPage(tool: ToolMeta): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tool.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: stripTags(f.answer) },
    })),
  };
}

export function howTo(tool: ToolMeta): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use the ${tool.name}`,
    description: tool.tagline,
    totalTime: 'PT1M',
    tool: { '@type': 'HowToTool', name: tool.name },
    step: tool.howTo.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    })),
  };
}

export function toolJsonLd(tool: ToolMeta): JsonLd[] {
  return [softwareApplication(tool), breadcrumbs(toolCrumbs(tool)), faqPage(tool), howTo(tool)];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
