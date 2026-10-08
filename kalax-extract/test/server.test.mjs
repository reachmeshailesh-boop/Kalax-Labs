import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from '../src/ratelimit.mjs';
import { JPEG, PNG, WEBP, config, post, startServer } from './helpers.mjs';

test('mock path: extraction returns a validated report, CSV and review count', async () => {
    const app = await startServer({ config: config() });

    try {
        const response = await post(app.base, JPEG, { fixture: 'partial-extraction' });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(body).sort(), ['csv', 'report', 'reviewCount']);
        assert.equal(body.reviewCount, 3);
        assert.match(body.csv, /^"section","item","owner","due"\r\n/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    } finally {
        await app.close();
    }
});

test('PNG and WebP are accepted too', async () => {
    const app = await startServer({ config: config() });

    try {
        assert.equal((await post(app.base, PNG, { type: 'image/png' })).status, 200);
        assert.equal((await post(app.base, WEBP, { type: 'image/webp' })).status, 200);
    } finally {
        await app.close();
    }
});

test('HTTP failures: type, size, empty, unreadable, malformed', async () => {
    const app = await startServer({ config: config({ EXTRACT_MAX_IMAGE_BYTES: '2048' }) });

    try {
        const expectations = [
            [post(app.base, Buffer.from('%PDF-1.4'), { type: 'application/pdf' }), 415, 'UNSUPPORTED_TYPE'],
            [post(app.base, Buffer.concat([JPEG, Buffer.alloc(4096)])), 413, 'TOO_LARGE'],
            [post(app.base, Buffer.alloc(0)), 400, 'EMPTY_UPLOAD'],
            [post(app.base, JPEG, { fixture: 'unusable-image' }), 422, 'UNREADABLE'],
            [post(app.base, JPEG, { fixture: 'malformed-response' }), 502, 'PROVIDER_BAD_RESPONSE'],
        ];

        for (const [pending, status, code] of expectations) {
            const response = await pending;
            const body = await response.json();

            assert.equal(response.status, status, code);
            assert.equal(body.error.code, code);
            assert.deepEqual(Object.keys(body), ['error']);
            assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
        }
    } finally {
        await app.close();
    }
});

test('rate limiting returns 429 with Retry-After and a safe body', async () => {
    const app = await startServer({ config: config({ EXTRACT_RATE_LIMIT: '2' }) });

    try {
        assert.equal((await post(app.base, JPEG)).status, 200);
        assert.equal((await post(app.base, JPEG)).status, 200);

        const blocked = await post(app.base, JPEG);

        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
        assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
    } finally {
        await app.close();
    }
});

test('X-Forwarded-For is ignored unless the proxy is trusted', async () => {
    const run = async (env) => {
        const app = await startServer({ config: config({ EXTRACT_RATE_LIMIT: '1', ...env }) });

        try {
            await post(app.base, JPEG, { headers: { 'X-Forwarded-For': '1.1.1.1' } });

            return (await post(app.base, JPEG, { headers: { 'X-Forwarded-For': '2.2.2.2' } })).status;
        } finally {
            await app.close();
        }
    };

    assert.equal(await run({}), 429, 'spoofed header cannot evade the limit');
    assert.equal(await run({ EXTRACT_TRUST_PROXY: '1' }), 200, 'trusted proxy header separates clients');
});

test('mock fixture header is ignored when the provider is gemini', async () => {
    let calls = 0;
    const provider = { name: 'spy', extract: async () => { calls += 1; return JSON.stringify({ title: '', summary: '', keyPoints: ['Spy output'], decisions: [], actions: [], people: [], datesAndNumbers: [], needsReview: [], transcription: 'Spy output only here' }); } };
    const app = await startServer({
        config: config({ EXTRACT_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }),
        provider,
    });

    try {
        const body = await (await post(app.base, JPEG, { fixture: 'clean-meeting' })).json();

        assert.equal(calls, 1);
        assert.deepEqual(body.report.keyPoints, ['Spy output']);

        const cfg = await (await fetch(`${app.base}/api/config`)).json();

        assert.equal(cfg.mock, false);
        assert.deepEqual(cfg.fixtures, []);
    } finally {
        await app.close();
    }
});

test('gemini selected without configuration fails safely and keeps serving', async () => {
    const app = await startServer({ config: config({ EXTRACT_PROVIDER: 'gemini' }) });

    try {
        const response = await post(app.base, JPEG);
        const text = await response.text();

        assert.equal(response.status, 503);
        assert.equal(JSON.parse(text).error.code, 'NOT_CONFIGURED');
        assert.doesNotMatch(text, /GEMINI|api key|apikey/i);
        assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
    } finally {
        await app.close();
    }
});

test('internal errors never leak stack traces, paths or secrets to the browser', async () => {
    const original = console.error;

    console.error = () => {};

    const provider = { name: 'x', extract: async () => ({ get title() { throw new TypeError('AIzaSySECRET at /srv/kalax/src/x.mjs:9'); } }) };
    const app = await startServer({ config: config(), provider });

    try {
        const response = await post(app.base, JPEG);
        const text = await response.text();

        assert.ok(response.status >= 500);
        assert.doesNotMatch(text, /AIza|SECRET|srv|\.mjs|stack| at /);
    } finally {
        console.error = original;
        await app.close();
    }
});

test('only the documented surfaces exist; no JSON download surface', async () => {
    const app = await startServer({ config: config() });

    try {
        for (const path of ['/api/report.json', '/api/export', '/api/json', '/report.json', '/api/csv']) {
            assert.equal((await fetch(`${app.base}${path}`)).status, 404, path);
        }

        assert.equal((await fetch(`${app.base}/api/extract`)).status, 405);

        const page = await (await fetch(app.base)).text();

        assert.doesNotMatch(page, /download[^>]*\.json|Download JSON|application\/json/i);
        assert.match(page, /Download CSV/);
    } finally {
        await app.close();
    }
});

test('static serving refuses traversal and non-public files', async () => {
    const app = await startServer({ config: config() });

    try {
        for (const path of ['/../package.json', '/..%2fsrc/config.mjs', '/%2e%2e/.env.example', '/src/server.mjs', '/package.json']) {
            const response = await fetch(`${app.base}${path}`);

            assert.equal(response.status, 404, path);
        }

        const ok = await fetch(app.base);

        assert.equal(ok.status, 200);
        assert.match(ok.headers.get('content-security-policy'), /default-src 'self'/);
    } finally {
        await app.close();
    }
});

test('the page states the privacy boundary without overclaiming', async () => {
    const app = await startServer({ config: config() });

    try {
        const page = await (await fetch(app.base)).text();

        assert.match(page, /does not intentionally store the uploaded image or the\s+extracted report/);
        assert.match(page, /external AI provider/);
        assert.doesNotMatch(page, /never leaves|nothing is (stored|retained)|provider (does not|doesn't) (store|retain|keep)/i);
    } finally {
        await app.close();
    }
});

test('behind a trusted proxy, a client-supplied leading X-Forwarded-For entry cannot evade the limit', async () => {
    const app = await startServer({ config: config({ EXTRACT_RATE_LIMIT: '1', EXTRACT_TRUST_PROXY: '1' }) });

    try {
        await post(app.base, JPEG, { headers: { 'X-Forwarded-For': 'spoof-1, 9.9.9.9' } });

        const second = await post(app.base, JPEG, { headers: { 'X-Forwarded-For': 'spoof-2, 9.9.9.9' } });

        assert.equal(second.status, 429);
    } finally {
        await app.close();
    }
});
