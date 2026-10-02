import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  crawlSite,
  validateSiteCheckInput,
} from '../src/crawler.mjs';

test('input: rejects unsupported protocols', () => {
  assert.throws(
    () => validateSiteCheckInput('ftp://example.test/', 20),
    /Only HTTP and HTTPS/,
  );
});

test('input: rejects page limits above 20', () => {
  assert.throws(
    () => validateSiteCheckInput('https://example.test/', 21),
    /maxPages must be between 1 and 20/,
  );
});

test('crawler: stops after depth 2', async (t) => {
  const pages = new Map([
    ['/', '<title>Depth 0</title><a href="/level-1">Level 1</a>'],
    ['/level-1', '<title>Depth 1</title><a href="/level-2">Level 2</a>'],
    ['/level-2', '<title>Depth 2</title><a href="/level-3">Level 3</a>'],
    ['/level-3', '<title>Depth 3</title>'],
  ]);

  const requested = [];

  const server = http.createServer((req, res) => {
    requested.push(req.url);

    const body = pages.get(req.url);

    if (!body) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head>${body}</head><body></body></html>`);
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  t.after(() => {
    server.close();
  });

  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const result = await crawlSite(`${base}/`, 20);

  const depths = result.pages.map((page) => page.depth);
  const urls = result.pages.map((page) => page.url);

  assert.equal(result.pagesChecked, 3);
  assert.equal(Math.max(...depths), 2);

  assert.ok(depths.includes(0));
  assert.ok(depths.includes(1));
  assert.ok(depths.includes(2));

  assert.equal(
    urls.some((url) => url.endsWith('/level-3')),
    false,
  );

  assert.equal(
    requested.some((url) => url === '/level-3'),
    false,
  );
});
