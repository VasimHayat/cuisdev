#!/usr/bin/env node
/**
 * Render public/favicon.svg into the PNG icons referenced by the manifest and
 * <head>. Re-run after changing the logo:  npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const source = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function render(svg: string, size: number, file: string): void {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(outDir, file), png);
  console.log(`  ✔ icons/${file} (${size}×${size}, ${(png.byteLength / 1024).toFixed(1)} KB)`);
}

// Maskable icons need ~10% safe-zone padding on every side.
const maskable = source
  .replace(/<svg[^>]*>/, (tag) => tag.replace(/viewBox="[^"]*"/, 'viewBox="-8 -8 80 80"'))
  .replace(
    /<rect width="64" height="64" rx="14"/,
    '<rect x="-8" y="-8" width="80" height="80" rx="0"',
  );

render(source, 32, 'icon-32.png');
render(source, 180, 'apple-touch-icon.png');
render(source, 192, 'icon-192.png');
render(source, 512, 'icon-512.png');
render(maskable, 512, 'icon-512-maskable.png');
