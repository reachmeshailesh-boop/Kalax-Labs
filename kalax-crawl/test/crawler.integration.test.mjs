import test from 'node:test';
import assert from 'node:assert/strict';

import {
    crawlSite,
} from '../src/crawler.mjs';

test(
    'example.com real crawl succeeds',
    {
        timeout: 30_000,
    },
    async () => {
        const crawl = await crawlSite(
            'https://example.com',
            1,
        );

        assert.equal(
            crawl.results.length,
            1,
        );

        assert.equal(
            crawl.results[0].title,
            'Example Domain',
        );

        assert.equal(
            crawl.results[0].status,
            'OK',
        );
    },
);

test(
    'same URL can be crawled repeatedly',
    {
        timeout: 60_000,
    },
    async () => {
        const first = await crawlSite(
            'https://example.com',
            1,
        );

        const second = await crawlSite(
            'https://example.com',
            1,
        );

        assert.equal(
            first.results.length,
            1,
        );

        assert.equal(
            second.results.length,
            1,
        );
    },
);

test(
    'recursive crawl is bounded, unique and same-host',
    {
        timeout: 60_000,
    },
    async () => {
        const crawl = await crawlSite(
            'https://www.scrapethissite.com/pages/',
            5,
        );

        assert.equal(
            crawl.results.length,
            5,
        );

        const urls = crawl.results.map(
            (row) => row.url,
        );

        assert.equal(
            new Set(urls).size,
            urls.length,
        );

        for (const url of urls) {
            assert.equal(
                new URL(url).hostname,
                'www.scrapethissite.com',
            );
        }
    },
);
