import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig, assertProviderConfigured } from '../src/config.mjs';
import { csvCell, reportToCsv } from '../src/csv.mjs';
import { ExtractError, toExtractError } from '../src/errors.mjs';
import { runExtraction } from '../src/extract.mjs';
import { applyFidelityGuard } from '../src/guard.mjs';
import { FIXTURES, FIXTURE_NAMES } from '../src/providers/fixtures.mjs';
import { createMockProvider } from '../src/providers/mock.mjs';
import { createRateLimiter } from '../src/ratelimit.mjs';
import { validateReport } from '../src/schema.mjs';
import { validateUpload } from '../src/upload.mjs';
import { JPEG, PNG, WEBP, config, parseCsv } from './helpers.mjs';

const mock = createMockProvider();
const cfg = config();

const run = (hint, provider = mock, conf = cfg) =>
    runExtraction({ bytes: JPEG, contentType: 'image/jpeg', hint }, { config: conf, provider });

const code = (promise) =>
    promise.then(
        () => 'resolved',
        (error) => error.code,
    );

const blank = {
    title: '', summary: '', keyPoints: [], decisions: [], actions: [],
    people: [], datesAndNumbers: [], needsReview: [], transcription: '',
};

const stub = (output) => ({ name: 'stub', extract: async () => output });

test('allowed MIME types are accepted', () => {
    for (const [bytes, contentType] of [[JPEG, 'image/jpeg'], [PNG, 'image/png'], [WEBP, 'image/webp']]) {
        assert.equal(validateUpload({ bytes, contentType, maxBytes: 1e6 }).mime, contentType);
    }
});

test('rejected MIME types and mismatched content are refused', () => {
    const attempt = (bytes, contentType) => {
        try { validateUpload({ bytes, contentType, maxBytes: 1e6 }); return 'accepted'; }
        catch (error) { return error.code; }
    };

    assert.equal(attempt(Buffer.from('%PDF-1.7'), 'application/pdf'), 'UNSUPPORTED_TYPE');
    assert.equal(attempt(Buffer.from('GIF89a......'), 'image/gif'), 'UNSUPPORTED_TYPE');
    assert.equal(attempt(Buffer.from('<svg></svg>'), 'image/svg+xml'), 'UNSUPPORTED_TYPE');
    assert.equal(attempt(Buffer.from('%PDF-1.7 pretending'), 'image/jpeg'), 'UNSUPPORTED_TYPE');
    assert.equal(attempt(PNG, 'image/jpeg'), 'UNSUPPORTED_TYPE');
    assert.equal(attempt(JPEG, undefined), 'UNSUPPORTED_TYPE');
});

test('size limit is enforced at the boundary', () => {
    const attempt = (n) => {
        try { validateUpload({ bytes: Buffer.concat([JPEG, Buffer.alloc(n)]), contentType: 'image/jpeg', maxBytes: JPEG.length + 10 }); return 'ok'; }
        catch (error) { return error.code; }
    };

    assert.equal(attempt(10), 'ok');
    assert.equal(attempt(11), 'TOO_LARGE');
});

test('empty input is refused', () => {
    assert.throws(() => validateUpload({ bytes: Buffer.alloc(0), contentType: 'image/jpeg', maxBytes: 100 }), { code: 'EMPTY_UPLOAD' });
});

test('every fixture except the failure ones passes strict schema validation', () => {
    for (const name of FIXTURE_NAMES) {
        if (name === 'malformed-response') continue;
        assert.doesNotThrow(() => validateReport(FIXTURES[name]), name);
    }
});

test('schema rejects malformed shapes instead of repairing them', () => {
    const cases = {
        missingKey: (({ summary, ...rest }) => rest)(blank),
        extraKey: { ...blank, extra: 'x' },
        wrongType: { ...blank, keyPoints: 'one' },
        nonStringItem: { ...blank, people: [1] },
        badAction: { ...blank, actions: [{ action: 'x', owner: 'y' }] },
        extraActionKey: { ...blank, actions: [{ action: 'x', owner: '', due: '', priority: 'high' }] },
        array: [],
        nullish: null,
        tooLong: { ...blank, summary: 'x'.repeat(30000) },
    };

    for (const [name, value] of Object.entries(cases)) {
        assert.throws(() => validateReport(value), { code: 'PROVIDER_BAD_RESPONSE' }, name);
    }
});

test('malformed provider fixture fails safely through the pipeline', async () => {
    assert.equal(await code(run('malformed-response')), 'PROVIDER_BAD_RESPONSE');
    assert.equal(await code(run(undefined, stub('not json at all'))), 'PROVIDER_BAD_RESPONSE');
    assert.equal(await code(run(undefined, stub({ ...blank, bogus: true }))), 'PROVIDER_BAD_RESPONSE');
});

test('missing owner is preserved as empty, never filled', async () => {
    const { report } = await run('missing-owner');

    assert.equal(report.actions[0].owner, '');
    assert.equal(report.actions[0].due, 'Monday');
});

test('missing deadline is preserved as empty, never filled', async () => {
    const { report } = await run('missing-deadline');

    assert.equal(report.actions[0].owner, 'Neha');
    assert.equal(report.actions[0].due, '');
});

test('uncertainty is preserved and counted', async () => {
    const ambiguous = await run('ambiguous-handwriting');

    assert.equal(ambiguous.reviewCount, 3);
    assert.match(ambiguous.report.needsReview.join(' '), /Sam|Sara/);

    const partial = await run('partial-extraction');

    assert.equal(partial.reviewCount, 3);
    assert.ok(partial.report.keyPoints.length > 0, 'partial success keeps what was readable');
});

test('a note with no decisions yields none', async () => {
    assert.deepEqual((await run('no-decisions')).report.decisions, []);
});

test('names and monetary values survive exactly', async () => {
    const { report } = await run('names-and-money');

    assert.deepEqual(report.datesAndNumbers, ['Rs 250000', 'Rs 40000']);
    assert.deepEqual(report.people, ['Kavita', 'Suresh']);
});

test('unusable image fails safely with the human-readable message', async () => {
    const error = await run('unusable-image').catch((e) => e);

    assert.equal(error.code, 'UNREADABLE');
    assert.match(error.message, /couldn't confidently read enough of this note/);
});

test('mock default selection is deterministic and never a failure fixture', async () => {
    const a = await mock.extract({ bytes: JPEG });
    const b = await mock.extract({ bytes: JPEG });

    assert.deepEqual(a, b);
    assert.notEqual(typeof a, 'string');
});

test('guard removes invented owners, deadlines and amounts and says so', async () => {
    const invented = {
        ...blank,
        title: 'Quote',
        summary: 'Discuss quotation.',
        keyPoints: ['Discuss quotation', 'Quote value is 90000'],
        actions: [{ action: 'Send quotation to customer', owner: 'Rahul', due: 'by 15 Friday' }],
        people: ['Rahul'],
        datesAndNumbers: ['90000'],
        transcription: 'Discuss quotation',
    };
    const { report } = await run(undefined, stub(invented));

    assert.deepEqual(report.people, []);
    assert.deepEqual(report.datesAndNumbers, []);
    assert.deepEqual(report.keyPoints, ['Discuss quotation']);
    assert.equal(report.actions[0].owner, '');
    assert.equal(report.actions[0].due, '');
    assert.ok(report.needsReview.length >= 4, 'every removal is surfaced, not silent');
});

test('guard leaves grounded content untouched', () => {
    const grounded = validateReport(FIXTURES['action-owner-deadline']);

    assert.deepEqual(applyFidelityGuard(grounded), grounded);
});

test('CSV cells escape quotes, commas, newlines and formula triggers', () => {
    assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
    assert.equal(csvCell('=SUM(A1)'), `"'=SUM(A1)"`);
    assert.equal(csvCell('@cmd'), `"'@cmd"`);
    assert.equal(csvCell('plain'), '"plain"');
});

test('CSV equals the validated report for every readable fixture', async () => {
    for (const name of FIXTURE_NAMES) {
        if (name === 'malformed-response' || name === 'unusable-image') continue;

        const { report, csv } = await run(name);
        const rows = parseCsv(csv);

        assert.deepEqual(rows[0], ['section', 'item', 'owner', 'due']);

        const rebuilt = { title: '', summary: '', transcription: '', keyPoints: [], decisions: [], people: [], datesAndNumbers: [], needsReview: [], actions: [] };
        const listFields = { key_point: 'keyPoints', decision: 'decisions', person: 'people', date_or_number: 'datesAndNumbers', needs_review: 'needsReview' };

        for (const [section, item, owner, due] of rows.slice(1)) {
            if (section === 'action') rebuilt.actions.push({ action: item, owner, due });
            else if (listFields[section]) rebuilt[listFields[section]].push(item);
            else rebuilt[section] = item;
        }

        assert.deepEqual(rebuilt, JSON.parse(JSON.stringify(report)), name);
        assert.equal(csv, reportToCsv(report), 'deterministic');
    }
});

test('CSV with hostile content still round-trips as text', () => {
    const report = validateReport({ ...blank, keyPoints: ['=HYPERLINK("x")', 'a,b'], transcription: 'line1\nline2' });
    const rows = parseCsv(reportToCsv(report));

    assert.equal(rows[1][1], `'=HYPERLINK("x")`);
    assert.equal(rows[2][1], 'a,b');
    assert.equal(rows.at(-1)[1], 'line1\nline2');
});

test('provider timeout is mapped to a safe error', async () => {
    const slow = { name: 'slow', extract: () => new Promise(() => {}) };

    assert.equal(await code(run(undefined, slow, { ...cfg, timeoutMs: 30 })), 'PROVIDER_TIMEOUT');
});

test('unexpected provider crashes become PROVIDER_UNAVAILABLE without leaking detail', async () => {
    const crashing = { name: 'boom', extract: async () => { throw new Error('secret-key-abc stack trace'); } };
    const error = await run(undefined, crashing).catch((e) => e);

    assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
    assert.doesNotMatch(error.message, /secret|stack/);
});

test('unknown errors collapse to INTERNAL with a generic message', () => {
    const safe = toExtractError(new Error('db password=hunter2 at /srv/app.js:10'));

    assert.ok(safe instanceof ExtractError);
    assert.equal(safe.code, 'INTERNAL');
    assert.doesNotMatch(safe.message, /hunter2|srv/);
});

test('Gemini configuration guard', async () => {
    const gemini = loadConfig({ EXTRACT_PROVIDER: 'gemini' });

    assert.throws(() => assertProviderConfigured(gemini), { code: 'NOT_CONFIGURED' });
    assert.doesNotThrow(() => assertProviderConfigured(loadConfig({ EXTRACT_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' })));
    assert.doesNotThrow(() => assertProviderConfigured(loadConfig({})));
    assert.equal(loadConfig({}).provider, 'mock', 'defaults to mock');
    assert.throws(() => loadConfig({ EXTRACT_PROVIDER: 'openai' }));

    const provider = { name: 'never', extract: async () => { throw new Error('must not be called'); } };

    assert.equal(await code(run(undefined, provider, gemini)), 'NOT_CONFIGURED');
});

test('rate limiter allows the limit, blocks the next, and resets after the window', () => {
    let now = 1000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    assert.equal(limiter.take('a').allowed, true);
    assert.equal(limiter.take('a').allowed, true);
    assert.equal(limiter.take('b').allowed, true, 'keys are independent');

    const blocked = limiter.take('a');

    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);

    now += 1001;
    assert.equal(limiter.take('a').allowed, true);
});
