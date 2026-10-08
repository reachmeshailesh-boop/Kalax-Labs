import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertProviderConfigured, loadConfig } from './config.mjs';
import { ExtractError, toExtractError } from './errors.mjs';
import { runExtraction } from './extract.mjs';
import { createProvider } from './providers/index.mjs';
import { FIXTURE_NAMES } from './providers/fixtures.mjs';
import { createRateLimiter } from './ratelimit.mjs';
import { ALLOWED_MIME } from './upload.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
};

const SECURITY_HEADERS = {
    'Content-Security-Policy':
        "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
};

function sendJson(res, status, body, extra = {}) {
    res.writeHead(status, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extra,
    });
    res.end(JSON.stringify(body));
}

// The only error shape the browser ever receives.
function sendError(res, error, extra = {}) {
    const safe = toExtractError(error);

    sendJson(
        res,
        safe.status,
        { error: { code: safe.code, message: safe.message } },
        extra,
    );
}

// Reads the body with a hard cap so an oversized upload is cut off early
// instead of being buffered in full.
async function readBody(req, maxBytes) {
    const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);

    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new ExtractError('TOO_LARGE');
    }

    const chunks = [];
    let total = 0;

    for await (const chunk of req) {
        total += chunk.length;

        if (total > maxBytes) throw new ExtractError('TOO_LARGE');

        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

function clientKey(req, config) {
    if (config.trustProxy) {
        const forwarded = String(req.headers['x-forwarded-for'] ?? '')
            .split(',')[0]
            .trim();

        if (forwarded) return forwarded;
    }

    return req.socket.remoteAddress ?? 'unknown';
}

async function serveStatic(res, pathname) {
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(publicDir, name);

    if (!file.startsWith(publicDir + path.sep)) {
        throw new ExtractError('NOT_FOUND');
    }

    const type = CONTENT_TYPES[path.extname(file)];

    if (!type) throw new ExtractError('NOT_FOUND');

    let body;

    try {
        body = await readFile(file);
    } catch {
        throw new ExtractError('NOT_FOUND');
    }

    res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': type,
        'Cache-Control': 'no-cache',
    });
    res.end(body);
}

export function createExtractServer({
    config = loadConfig(),
    provider = createProvider(config),
    limiter = createRateLimiter({
        limit: config.rateLimit,
        windowMs: config.rateWindowMs,
    }),
} = {}) {
    return http.createServer(async (req, res) => {
        try {
            const { pathname } = new URL(req.url, 'http://localhost');

            if (pathname === '/api/health') {
                return sendJson(res, 200, {
                    status: 'ok',
                    product: 'Kalax Extract',
                });
            }

            if (pathname === '/api/config') {
                return sendJson(res, 200, {
                    allowedTypes: ALLOWED_MIME,
                    maxImageBytes: config.maxImageBytes,
                    mock: config.provider === 'mock',
                    fixtures: config.provider === 'mock' ? FIXTURE_NAMES : [],
                    ctaUrl: config.ctaUrl,
                });
            }

            if (pathname === '/api/extract') {
                if (req.method !== 'POST') {
                    return sendError(res, new ExtractError('METHOD_NOT_ALLOWED'), {
                        Allow: 'POST',
                    });
                }

                const slot = limiter.take(clientKey(req, config));

                if (!slot.allowed) {
                    return sendError(res, new ExtractError('RATE_LIMITED'), {
                        'Retry-After': String(slot.retryAfterSeconds),
                    });
                }

                const bytes = await readBody(req, config.maxImageBytes);

                // Fixture selection exists only for the mock provider.
                const hint =
                    config.provider === 'mock'
                        ? String(req.headers['x-mock-fixture'] ?? '')
                        : '';

                const result = await runExtraction(
                    {
                        bytes,
                        contentType: req.headers['content-type'],
                        hint,
                    },
                    { config, provider },
                );

                return sendJson(res, 200, result);
            }

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                return sendError(res, new ExtractError('METHOD_NOT_ALLOWED'));
            }

            return await serveStatic(res, pathname);
        } catch (error) {
            const safe = toExtractError(error);

            // Detail stays server-side and carries no payloads or keys.
            if (safe.code === 'INTERNAL') console.error('Unhandled request error.');

            if (!res.headersSent) sendError(res, safe);
            else res.end();
        }
    });
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const config = loadConfig();

    try {
        assertProviderConfigured(config);
    } catch {
        console.warn(
            'EXTRACT_PROVIDER=gemini but Gemini is not configured. Extractions will fail safely until it is.',
        );
    }

    createExtractServer({ config }).listen(config.port, config.host, () => {
        console.log(
            `Kalax Extract (${config.provider} provider) listening on http://${config.host}:${config.port}`,
        );
    });
}
