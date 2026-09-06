#!/usr/bin/env node
/**
 * Minimal static server for `dist/`, used by Playwright (the Astro preview
 * server daemonises itself, which Playwright's webServer cannot supervise).
 * Mirrors Cloudflare Pages behaviour: directory → index.html, trailing-slash
 * redirects, and a real 404 status with dist/404.html.
 *
 *   node scripts/serve-dist.ts [--port 4321] [--dir dist]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4321' },
    dir: { type: 'string', default: 'dist' },
  },
});

const root = resolve(process.cwd(), values.dir ?? 'dist');
const port = Number(values.port);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function send(res: ServerResponse, file: string, status = 200): void {
  res.writeHead(status, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': statSync(file).size,
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  // Prevent path traversal: normalise and keep within root.
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safePath);

  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }

  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` }).end();
      return;
    }
    file = join(file, 'index.html');
  }

  if (existsSync(file) && statSync(file).isFile()) {
    send(res, file);
    return;
  }

  const notFound = join(root, '404.html');
  if (existsSync(notFound)) send(res, notFound, 404);
  else res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
