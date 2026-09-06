import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import sitemap from '@astrojs/sitemap';
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
      changefreq: 'weekly',
      priority: 0.7,
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
