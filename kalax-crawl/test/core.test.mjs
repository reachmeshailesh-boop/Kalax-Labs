import test from 'node:test';
import assert from 'node:assert/strict';

import {
    validateCrawlInput,
} from '../src/crawler.mjs';

import {
    exportResults,
} from '../src/export.mjs';

import {
    mkdtemp,
    readFile,
    rm,
} from 'node:fs/promises';

import os from 'node:os';
import path from 'node:path';

test('valid crawl input is normalized', () => {
    const result = validateCrawlInput(
        'https://example.com',
        10,
    );

    assert.equal(
        result.target.href,
        'https://example.com/',
    );

    assert.equal(
        result.maxPages,
        10,
    );
});

test('invalid URL is rejected', () => {
    assert.throws(
        () =>
            validateCrawlInput(
                'not-a-url',
                10,
            ),
        /Invalid URL/,
    );
});

test('unsupported protocol is rejected', () => {
    assert.throws(
        () =>
            validateCrawlInput(
                'ftp://example.com',
                10,
            ),
        /Only http:\/\/ and https:\/\//,
    );
});

test('page limits are enforced', () => {
    assert.throws(
        () =>
            validateCrawlInput(
                'https://example.com',
                0,
            ),
        /between 1 and 500/,
    );

    assert.throws(
        () =>
            validateCrawlInput(
                'https://example.com',
                501,
            ),
        /between 1 and 500/,
    );
});

test('JSON and CSV exports match result data', async () => {
    const temp = await mkdtemp(
        path.join(
            os.tmpdir(),
            'kalax-crawl-test-',
        ),
    );

    const rows = [
        {
            url: 'https://example.com/',
            title: 'Example, "Domain"',
            status: 'OK',
        },
    ];

    try {
        const paths = await exportResults(
            rows,
            temp,
        );

        const json = JSON.parse(
            await readFile(
                paths.jsonPath,
                'utf8',
            ),
        );

        const csv = await readFile(
            paths.csvPath,
            'utf8',
        );

        assert.deepEqual(
            json,
            rows,
        );

        assert.equal(
            csv,
            [
                'url,title,status',
                'https://example.com/,"Example, ""Domain""",OK',
                '',
            ].join('\n'),
        );
    } finally {
        await rm(
            temp,
            {
                recursive: true,
                force: true,
            },
        );
    }
});
