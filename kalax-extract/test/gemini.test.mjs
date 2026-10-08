import assert from 'node:assert/strict';
import test from 'node:test';
import { runExtraction } from '../src/extract.mjs';
import { createGeminiProvider } from '../src/providers/gemini.mjs';
import { FIXTURES } from '../src/providers/fixtures.mjs';
import { JPEG, config } from './helpers.mjs';

const reply = (status, body) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const candidate = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const make = (fetchImpl, extra = {}) => createGeminiProvider({ apiKey: 'test-key-123', model: 'model-x', fetchImpl, timeoutMs: 500, ...extra });
const call = (provider) => provider.extract({ bytes: JPEG, mime: 'image/jpeg' });
const code = (promise) => promise.then(() => 'resolved', (error) => error.code);

test('sends exactly one multimodal request with the image inline and the key in a header', async () => {
    const seen = [];
    const provider = make(async (url, init) => { seen.push({ url, init }); return reply(200, candidate('{}'))(); });

    await call(provider);

    assert.equal(seen.length, 1);

    const { url, init } = seen[0];
    const body = JSON.parse(init.body);

    assert.match(url, /models\/model-x:generateContent$/);
    assert.doesNotMatch(url, /test-key-123|key=/, 'key never in the URL');
    assert.equal(init.headers['x-goog-api-key'], 'test-key-123');
    assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');
    assert.equal(body.contents[0].parts[1].inline_data.data, JPEG.toString('base64'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.match(body.contents[0].parts[0].text, /Never invent/);
});

test('model name is configurable', async () => {
    let url = '';

    await call(make(async (u) => { url = u; return reply(200, candidate('{}'))(); }, { model: 'gemini-future-9' }));

    assert.match(url, /models\/gemini-future-9:generateContent/);
});

test('HTTP and transport failures map to safe codes', async () => {
    assert.equal(await code(call(make(reply(429, 'quota detail AIzaSySECRET')))), 'PROVIDER_RATE_LIMITED');
    assert.equal(await code(call(make(reply(500, 'oops')))), 'PROVIDER_UNAVAILABLE');
    assert.equal(await code(call(make(reply(503, 'oops')))), 'PROVIDER_UNAVAILABLE');
    assert.equal(await code(call(make(reply(403, 'forbidden')))), 'NOT_CONFIGURED');
    assert.equal(await code(call(make(async () => { throw new TypeError('connect ECONNREFUSED 10.0.0.1'); }))), 'PROVIDER_UNAVAILABLE');
    assert.equal(await code(call(make(reply(200, 'not json')))), 'PROVIDER_BAD_RESPONSE');
    assert.equal(await code(call(make(reply(200, { candidates: [] })))), 'PROVIDER_BAD_RESPONSE');
    assert.equal(await code(call(make(reply(200, candidate(''))))), 'PROVIDER_BAD_RESPONSE');
});

test('a hung provider request times out', async () => {
    const hang = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' }))));

    // AbortSignal.timeout timers are unref'd; keep the test process alive.
    const keepAlive = setInterval(() => {}, 10);

    try {
        assert.equal(await code(call(make(hang, { timeoutMs: 40 }))), 'PROVIDER_TIMEOUT');
    } finally {
        clearInterval(keepAlive);
    }
});

test('missing key or model refuses to make any request', async () => {
    let called = false;
    const spy = async () => { called = true; return reply(200, candidate('{}'))(); };

    assert.equal(await code(call(createGeminiProvider({ apiKey: '', model: 'm', fetchImpl: spy }))), 'NOT_CONFIGURED');
    assert.equal(await code(call(createGeminiProvider({ apiKey: 'k', model: '', fetchImpl: spy }))), 'NOT_CONFIGURED');
    assert.equal(called, false);
});

test('Gemini output flows through the same validation, guard and CSV pipeline', async () => {
    const conf = config({ EXTRACT_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' });
    const ok = make(reply(200, candidate(JSON.stringify(FIXTURES['missing-owner']))));
    const result = await runExtraction({ bytes: JPEG, contentType: 'image/jpeg' }, { config: conf, provider: ok });

    assert.equal(result.report.actions[0].owner, '');
    assert.match(result.csv, /Review vendor contract/);

    const malformed = make(reply(200, candidate('{"title": "half')));

    assert.equal(await code(runExtraction({ bytes: JPEG, contentType: 'image/jpeg' }, { config: conf, provider: malformed })), 'PROVIDER_BAD_RESPONSE');
});

test('errors never carry the key or provider payload', async () => {
    const error = await call(make(reply(429, 'payload with test-key-123 inside'))).catch((e) => e);

    assert.doesNotMatch(`${error.message} ${error.stack}`, /test-key-123|payload/);
});
