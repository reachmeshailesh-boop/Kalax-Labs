import {
    PlaywrightCrawler,
    RequestQueue,
} from 'crawlee';

export function validateCrawlInput(rawTarget, requestedMaxPages = 10) {
    let target;

    try {
        target = new URL(rawTarget);
    } catch {
        throw new Error(`Invalid URL: ${rawTarget}`);
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error('Only http:// and https:// URLs are supported');
    }

    const maxPages = Number.parseInt(String(requestedMaxPages), 10);

    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) {
        throw new Error('Max pages must be an integer between 1 and 500');
    }

    return {
        target,
        maxPages,
    };
}

function createRunId() {
    return [
        'kalax-crawl',
        process.pid,
        Date.now(),
        crypto.randomUUID(),
    ].join('-');
}

export async function crawlSite(
    rawTarget,
    requestedMaxPages = 10,
    options = {},
) {
    const { target, maxPages } = validateCrawlInput(
        rawTarget,
        requestedMaxPages,
    );

    const results = [];

    const queueName = createRunId();
    const requestQueue = await RequestQueue.open(queueName);

    try {
        const crawler = new PlaywrightCrawler({
            requestQueue,
            maxRequestsPerCrawl: maxPages,

            async requestHandler({
                request,
                page,
                enqueueLinks,
                log,
            }) {
                const title = await page.title();

                const result = {
                    url: request.loadedUrl ?? request.url,
                    title,
                    status: 'OK',
                };

                results.push(result);

                options.onPage?.({
                    ...result,
                    current: results.length,
                    maxPages,
                });

                log.info(
                    `[${results.length}/${maxPages}] ${result.url}`,
                );

                await enqueueLinks({
                    strategy: 'same-hostname',
                });
            },

            async failedRequestHandler({ request, log }) {
                const result = {
                    url: request.url,
                    title: '',
                    status: 'FAILED',
                };

                results.push(result);

                options.onPage?.({
                    ...result,
                    current: results.length,
                    maxPages,
                });

                log.error(
                    `Failed after retries: ${request.url}`,
                );
            },
        });

        await crawler.run([target.href], {
            purgeRequestQueue: false,
        });

        return {
            target: target.href,
            hostname: target.hostname,
            maxPages,
            results,
        };
    } finally {
        await requestQueue.drop();
    }
}
