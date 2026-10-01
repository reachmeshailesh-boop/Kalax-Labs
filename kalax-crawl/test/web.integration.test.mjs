import test, {
    after,
    before,
} from 'node:test';

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

let server;

async function waitForServer() {
    for (
        let attempt = 0;
        attempt < 40;
        attempt += 1
    ) {
        try {
            const response = await fetch(
                'http://127.0.0.1:4173/api/health',
            );

            if (response.ok) {
                return;
            }
        } catch {
            // Not ready yet.
        }

        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    250,
                ),
        );
    }

    throw new Error(
        'Server did not become ready',
    );
}

before(async () => {
    server = spawn(
        process.execPath,
        ['src/server.mjs'],
        {
            stdio: 'ignore',
        },
    );

    await waitForServer();
});

after(async () => {
    if (!server) {
        return;
    }

    server.kill('SIGTERM');

    if (server.exitCode !== null) {
        return;
    }

    await Promise.race([
        new Promise((resolve) => {
            server.once(
                'exit',
                resolve,
            );
        }),

        new Promise((resolve) => {
            setTimeout(
                resolve,
                2_000,
            );
        }),
    ]);
});

test('health endpoint responds', async () => {
    const response = await fetch(
        'http://127.0.0.1:4173/api/health',
    );

    assert.equal(
        response.status,
        200,
    );

    const body = await response.json();

    assert.equal(
        body.status,
        'ok',
    );

    assert.equal(
        body.product,
        'Kalax Crawl',
    );
});

test(
    'JSON API returns real crawl result',
    {
        timeout: 30_000,
    },
    async () => {
        const response = await fetch(
            'http://127.0.0.1:4173/api/crawl',
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json',
                },

                body: JSON.stringify({
                    url:
                        'https://example.com',
                    maxPages: 1,
                }),
            },
        );

        assert.equal(
            response.status,
            200,
        );

        const body = await response.json();

        assert.equal(
            body.results.length,
            1,
        );

        assert.equal(
            body.results[0].title,
            'Example Domain',
        );
    },
);

test(
    'SSE emits five page events and completion',
    {
        timeout: 60_000,
    },
    async () => {
        const query =
            new URLSearchParams({
                url:
                    'https://www.scrapethissite.com/pages/',
                maxPages: '5',
            });

        const response = await fetch(
            `http://127.0.0.1:4173/api/crawl-stream?${query}`,
        );

        assert.equal(
            response.status,
            200,
        );

        const body = await response.text();

        const pages =
            body.match(
                /^event: page$/gm,
            ) ?? [];

        const complete =
            body.match(
                /^event: complete$/gm,
            ) ?? [];

        assert.equal(
            pages.length,
            5,
        );

        assert.equal(
            complete.length,
            1,
        );
    },
);

test(
    'invalid URL produces crawl-error event',
    async () => {
        const query =
            new URLSearchParams({
                url: 'not-a-url',
                maxPages: '5',
            });

        const response = await fetch(
            `http://127.0.0.1:4173/api/crawl-stream?${query}`,
        );

        const body = await response.text();

        assert.match(
            body,
            /^event: crawl-error$/m,
        );
    },
);
