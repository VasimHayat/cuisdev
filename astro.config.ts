import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import sitemap, { ChangeFreqEnum, type SitemapItem } from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/**
 * The theme-init script must run inline before first paint to avoid a flash of
 * the wrong theme. Astro's CSP integration does not hash `is:inline` scripts, so
 * we hash the exact file contents here and allow-list it. `BaseLayout.astro`
 * injects the very same bytes via a `?raw` import.
 */
const themeInitSource = readFileSync(new URL('./src/lib/theme-init.js', import.meta.url), 'utf8');
const themeInitHash =
  `sha256-${createHash('sha256').update(themeInitSource).digest('base64')}` as const;

export default defineConfig({
  site: 'https://www.cuisdev.com',
  trailingSlash: 'always',
  compressHTML: true,

  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },

  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },

  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        // 'wasm-unsafe-eval' lets hash-wasm compile its WebAssembly modules; it does not enable JS eval.
        resources: ["'self'", "'wasm-unsafe-eval'"],
        hashes: [themeInitHash],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },

  markdown: {
    syntaxHighlight: 'prism',
  },

  integrations: [
    sitemap({
      // Image endpoints, the service worker and the offline fallback are not content.
      filter: (page) =>
        !page.includes('/og/') && !page.includes('/sw.js') && !page.includes('/offline/'),
      // Tools are the product; legal pages barely change.
      serialize(item): SitemapItem {
        const path = new URL(item.url).pathname;
        const { WEEKLY: weekly, MONTHLY: monthly, YEARLY: yearly } = ChangeFreqEnum;
        if (path === '/') return { ...item, priority: 1.0, changefreq: weekly };
        if (path.startsWith('/tools/category/'))
          return { ...item, priority: 0.7, changefreq: weekly };
        if (path.startsWith('/tools/')) return { ...item, priority: 0.9, changefreq: monthly };
        if (path.startsWith('/blog/')) return { ...item, priority: 0.6, changefreq: monthly };
        return { ...item, priority: 0.3, changefreq: yearly };
      },
    }),
  ],

  vite: {
    build: {
      // Never inline assets as data: URLs — the CSP only allows 'self' for fonts.
      assetsInlineLimit: 0,
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: ['src/styles'],
        },
      },
    },
  },
});
