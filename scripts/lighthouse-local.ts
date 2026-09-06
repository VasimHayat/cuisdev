#!/usr/bin/env node
/**
 * Local Lighthouse runner for Windows machines where `lhci autorun` fails to
 * delete Chrome's temporary profile (EPERM). Uses a fixed profile directory so
 * nothing needs cleaning up, serves `dist/`, and checks the same thresholds as
 * lighthouserc.json. CI keeps using `npm run lhci`.
 *
 *   npm run build && node scripts/lighthouse-local.ts [--urls tools/base64/,tools/json-formatter/]
 *   (paths may omit the leading slash — Git Bash on Windows rewrites `/x` into a filesystem path)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const { values } = parseArgs({
  options: { urls: { type: 'string' }, port: { type: 'string', default: '4777' } },
});

const rc = JSON.parse(readFileSync('lighthouserc.json', 'utf8')) as {
  ci: { collect: { url: string[] } };
};
const port = Number(values.port);
const paths = values.urls
  ? values.urls.split(',').map((p) => (p.startsWith('/') ? p : `/${p}`))
  : rc.ci.collect.url.map((u) => new URL(u).pathname);

const profile = join(process.cwd(), '.lighthouseci', 'profile');
mkdirSync(profile, { recursive: true });

const server = spawn(process.execPath, ['scripts/serve-dist.ts', '--port', String(port)], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

let failed = false;
try {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-first-run', '--disable-extensions'],
    userDataDir: profile,
  });
  try {
    for (const path of paths) {
      const url = `http://localhost:${port}${path}`;
      // Same "desktop" preset lighthouserc.json uses, so numbers match CI.
      const result = await lighthouse(
        url,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        },
        desktopConfig,
      );
      const lhr = result?.lhr;
      if (!lhr) throw new Error(`No result for ${url}`);
      writeFileSync(
        join(process.cwd(), '.lighthouseci', `local${path.replace(/\//g, '_')}.json`),
        JSON.stringify(lhr),
      );
      const cats = Object.fromEntries(
        Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]),
      );
      const cls = Number(lhr.audits['cumulative-layout-shift']?.numericValue ?? 0);
      const items =
        (
          lhr.audits['resource-summary']?.details as {
            items?: { resourceType: string; transferSize: number }[];
          }
        )?.items ?? [];
      const js = items.find((i) => i.resourceType === 'script')?.transferSize ?? 0;
      const css = items.find((i) => i.resourceType === 'stylesheet')?.transferSize ?? 0;
      const jsBudget = path.startsWith('/tools/') ? 614_400 : 61_440; // blog + marketing pages ship no tool JS
      // A deliberately noindex page (the offline fallback) cannot score 100 for SEO.
      const noindex = lhr.audits['is-crawlable']?.score === 0;
      const gates = noindex
        ? ['accessibility', 'best-practices']
        : ['accessibility', 'best-practices', 'seo'];
      const problems: string[] = [];
      if ((cats.performance ?? 0) < 98) problems.push(`performance ${cats.performance}`);
      for (const c of gates) if ((cats[c] ?? 0) < 100) problems.push(`${c} ${cats[c]}`);
      if (cls > 0.01) problems.push(`CLS ${cls.toFixed(3)}`);
      if (js > jsBudget) problems.push(`JS ${js} > ${jsBudget}`);
      if (css > 122_880) problems.push(`CSS ${css} > 122880`);
      const line = `${path.padEnd(28)} perf ${cats.performance} a11y ${cats.accessibility} bp ${cats['best-practices']} seo ${cats.seo}  CLS ${cls.toFixed(3)}  JS ${(js / 1024).toFixed(1)} KB  CSS ${(css / 1024).toFixed(1)} KB`;
      console.log(problems.length ? `✖ ${line}\n    ${problems.join(', ')}` : `✔ ${line}`);
      if (problems.length) failed = true;
    }
  } finally {
    // Chrome sometimes refuses to clean up its temp profile on Windows; that must
    // not fail the run after the results are in.
    await chrome.kill().catch(() => undefined);
  }
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
