import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crawlSite } from './crawler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const port = Number.parseInt(process.env.PORT || '4173', 10);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
    });

    res.end(JSON.stringify(body));
}

function sendEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function readJsonBody(req) {
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
        const requestUrl = new URL(
            req.url,
            `http://${req.headers.host || 'localhost'}`,
        );

        if (
            req.method === 'GET' &&
            requestUrl.pathname === '/api/health'
        ) {
            return sendJson(res, 200, {
                status: 'ok',
                product: 'Kalax Crawl',
            });
        }

        if (
            req.method === 'POST' &&
            requestUrl.pathname === '/api/crawl'
        ) {
            const body = await readJsonBody(req);

            const crawl = await crawlSite(
                body.url,
                body.maxPages ?? 10,
            );

            return sendJson(res, 200, crawl);
        }

        if (
            req.method === 'GET' &&
            requestUrl.pathname === '/api/crawl-stream'
        ) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            });

            const url = requestUrl.searchParams.get('url');
            const maxPages =
                requestUrl.searchParams.get('maxPages') ?? '10';

            sendEvent(res, 'start', {
                url,
                maxPages: Number(maxPages),
            });

            try {
                const crawl = await crawlSite(
                    url,
                    maxPages,
                    {
                        onPage(page) {
                            sendEvent(res, 'page', page);
                        },
                    },
                );

                sendEvent(res, 'complete', crawl);
            } catch (error) {
                sendEvent(res, 'crawl-error', {
                    message:
                        error.message || 'Crawl failed',
                });
            }

            res.end();
            return;
        }

        if (req.method !== 'GET') {
            return sendJson(res, 405, {
                error: 'Method not allowed',
            });
        }

        const requestedPath =
            requestUrl.pathname === '/'
                ? '/index.html'
                : requestUrl.pathname;

        const filePath = path.resolve(
            publicDir,
            `.${requestedPath}`,
        );

        if (!filePath.startsWith(`${publicDir}${path.sep}`)) {
            return sendJson(res, 403, {
                error: 'Forbidden',
            });
        }

        try {
            const body = await readFile(filePath);
            const ext = path.extname(filePath);

            res.writeHead(200, {
                'Content-Type':
                    contentTypes[ext] ||
                    'application/octet-stream',
            });

            res.end(body);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return sendJson(res, 404, {
                    error: 'Not found',
                });
            }

            throw error;
        }
    } catch (error) {
        sendJson(res, 400, {
            error: error.message || 'Request failed',
        });
    }
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(
            `ERROR: port ${port} is already in use.`
        );
        process.exit(1);
    }

    throw error;
});

server.listen(port, '127.0.0.1', () => {
    console.log('=== KALAX CRAWL WEB ===');
    console.log(`LOCAL_URL=http://127.0.0.1:${port}`);
    console.log('SERVER_READY=PASS');
});
