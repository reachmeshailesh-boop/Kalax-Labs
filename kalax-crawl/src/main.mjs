import { crawlSite } from './crawler.mjs';
import { exportResults } from './export.mjs';

const rawTarget = process.argv[2] || 'https://example.com';
const requestedMaxPages = process.argv[3] || '10';

try {
    const crawl = await crawlSite(rawTarget, requestedMaxPages);

    const uniqueUrls = new Set(
        crawl.results.map((result) => result.url),
    );

    console.log('\n=== KALAX CRAWL SUMMARY ===');
    console.log(`TARGET=${crawl.target}`);
    console.log(`HOSTNAME=${crawl.hostname}`);
    console.log(`PAGES_PROCESSED=${crawl.results.length}`);
    console.log(`UNIQUE_URLS=${uniqueUrls.size}`);
    console.log(`MAX_PAGES=${crawl.maxPages}`);
    console.log(`DUPLICATES=${crawl.results.length - uniqueUrls.size}`);

    console.log('\n=== RESULTS ===');
    console.log(JSON.stringify(crawl.results, null, 2));

    const exported = await exportResults(crawl.results);

    console.log('\n=== EXPORT ===');
    console.log(`JSON=${exported.jsonPath}`);
    console.log(`CSV=${exported.csvPath}`);

    if (crawl.results.length > crawl.maxPages) {
        throw new Error('MAX_PAGE_ENFORCEMENT_FAIL');
    }

    console.log('MAX_PAGE_ENFORCEMENT=PASS');

    if (uniqueUrls.size !== crawl.results.length) {
        throw new Error('DEDUPLICATION_FAIL');
    }

    console.log('DEDUPLICATION=PASS');

    const escapedHostname = crawl.results.some((result) => {
        try {
            return new URL(result.url).hostname !== crawl.hostname;
        } catch {
            return true;
        }
    });

    if (escapedHostname) {
        throw new Error('HOSTNAME_BOUNDARY_FAIL');
    }

    console.log('HOSTNAME_BOUNDARY=PASS');
    console.log('CRAWL_COMPLETE=PASS');
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
}
