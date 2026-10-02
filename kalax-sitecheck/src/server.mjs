import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSiteCheck } from './sitecheck.mjs';
import { createSiteCheckPdf } from './report.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4174);

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function sendFile(res, filename, contentType) {
  const content = await readFile(join(publicDir, filename));

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });

  res.end(content);
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);

    if (req.method === 'GET' && url.pathname === '/') {
      return await sendFile(res, 'index.html', 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/styles.css') {
      return await sendFile(res, 'styles.css', 'text/css; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/app.js') {
      return await sendFile(res, 'app.js', 'text/javascript; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/results.js') {
      return await sendFile(res, 'results.js', 'text/javascript; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'kalax-sitecheck',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/check') {
      const body = await readJson(req);

      const result = await runSiteCheck(
        body.url,
        body.maxPages ?? 20,
      );

      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/api/report') {
      const result = await readJson(req);

      if (
        !result ||
        typeof result.requestedUrl !== 'string' ||
        !Array.isArray(result.findings) ||
        typeof result.pagesChecked !== 'number'
      ) {
        return sendJson(res, 400, {
          error: 'Invalid SiteCheck result',
        });
      }

      const pdf = createSiteCheckPdf(result);

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="sitecheck-report.pdf"',
        'Cache-Control': 'no-store',
      });

      pdf.pipe(res);
      pdf.end();
      return;
    }

    return sendJson(res, 404, {
      error: 'Not found',
    });
  } catch (error) {
    return sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Request failed',
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SiteCheck running at http://${HOST}:${PORT}`);
});
