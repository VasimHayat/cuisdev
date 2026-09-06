/**
 * Build-time Open Graph images: /og/default.png and /og/<tool-slug>.png.
 * SVG template → PNG via resvg (no browser, no React). Fonts come from the
 * build machine, so the card uses a generic sans-serif stack.
 */
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute, GetStaticPaths } from 'astro';

import { getCategory, getTool, tools } from '@/lib/registry';
import { site } from '@/lib/site';

export const getStaticPaths = (() => [
  { params: { slug: 'default' } },
  ...tools.map((t) => ({ params: { slug: t.slug } })),
]) satisfies GetStaticPaths;

const WIDTH = 1200;
const HEIGHT = 630;

const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  );

/** Greedy word wrap by approximate character width. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] ?? '';
    kept[maxLines - 1] = `${last.replace(/[.,;:]?$/, '')}…`;
    return kept;
  }
  return lines;
}

function template(opts: { eyebrow: string; title: string; subtitle: string }): string {
  const titleSize = opts.title.length > 26 ? 64 : 80;
  const titleLines = wrapText(opts.title, titleSize === 80 ? 22 : 28, 2);
  const subtitleLines = wrapText(opts.subtitle, 58, 2);
  const titleY = 250;
  const lineHeight = titleSize * 1.12;
  const subtitleY = titleY + titleLines.length * lineHeight + 16;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#132036"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#38bdf8" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <g transform="translate(80 80)">
    <rect width="64" height="64" rx="14" fill="#0b1220" stroke="#253247" stroke-width="2"/>
    <path d="M25 15c-5.5 0-8 2.5-8 8v4.5c0 3.2-1.8 5.2-5 5.5 3.2.3 5 2.3 5 5.5V43c0 5.5 2.5 8 8 8" fill="none" stroke="#38bdf8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M39 15c5.5 0 8 2.5 8 8v4.5c0 3.2 1.8 5.2 5 5.5-3.2.3-5 2.3-5 5.5V43c0 5.5-2.5 8-8 8" fill="none" stroke="#38bdf8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M36.5 20 27.5 44" fill="none" stroke="#f8fafc" stroke-width="4.5" stroke-linecap="round"/>
    <text x="84" y="44" font-family="sans-serif" font-size="34" font-weight="700" fill="#e6edf7">${escapeXml(site.name)}</text>
  </g>
  <text x="80" y="200" font-family="sans-serif" font-size="26" font-weight="600" fill="#38bdf8" letter-spacing="3">${escapeXml(opts.eyebrow.toUpperCase())}</text>
  ${titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${titleY + i * lineHeight + titleSize * 0.8}" font-family="sans-serif" font-size="${titleSize}" font-weight="700" fill="#f8fafc">${escapeXml(line)}</text>`,
    )
    .join('')}
  ${subtitleLines
    .map(
      (line, i) =>
        `<text x="80" y="${subtitleY + i * 42 + 32}" font-family="sans-serif" font-size="30" fill="#a3b1c6">${escapeXml(line)}</text>`,
    )
    .join('')}
  <g transform="translate(80 ${HEIGHT - 80})" font-family="sans-serif" font-size="24" fill="#8494ad">
    <text y="0">Free · Private · Runs in your browser</text>
    <text x="${WIDTH - 160}" y="0" text-anchor="end">${escapeXml(site.url.replace(/^https?:\/\//, ''))}</text>
  </g>
</svg>`;
}

export const GET: APIRoute = ({ params }) => {
  const tool = params.slug === 'default' ? undefined : getTool(params.slug ?? '');
  const svg = template(
    tool
      ? { eyebrow: getCategory(tool.category).name, title: tool.name, subtitle: tool.tagline }
      : {
          eyebrow: 'Developer tools',
          title: site.tagline,
          subtitle: 'Nothing you paste ever leaves your browser.',
        },
  );

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
