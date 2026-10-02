import { PlaywrightCrawler, RequestQueue } from "crawlee";

const DEFAULT_MAX_PAGES = 20;
const MAX_PAGES_LIMIT = 20;
const MAX_CRAWL_DEPTH = 2;

export function validateSiteCheckInput(inputUrl, maxPages = DEFAULT_MAX_PAGES) {
  let url;

  try {
    url = new URL(inputUrl);
  } catch {
    throw new Error('Enter a valid website URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS websites are supported.');
  }

  const pages = Number(maxPages);

  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES_LIMIT) {
    throw new Error(`maxPages must be between 1 and ${MAX_PAGES_LIMIT}.`);
  }

  url.hash = '';

  return {
    url: url.href,
    hostname: url.hostname.toLowerCase(),
    maxPages: pages,
  };
}

export async function capturePageEvidence(page, response) {
  const status = response?.status() ?? null;

  const evidence = await page.evaluate(() => {
    const attr = (selector, name) =>
      document.querySelector(selector)?.getAttribute(name)?.trim() || null;

    const links = [...document.querySelectorAll('a[href]')].map((a) => ({
      text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200),
      href: a.href,
    }));

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => script.textContent?.trim())
      .filter(Boolean);

    const forms = [...document.querySelectorAll('form')].map((form) => ({
      action: form.action || null,
      method: (form.method || 'get').toUpperCase(),
      fields: form.querySelectorAll('input, textarea, select').length,
    }));

    return {
      title: document.title?.trim() || null,
      description: attr('meta[name="description"]', 'content'),
      canonical: attr('link[rel="canonical"]', 'href'),
      viewport: attr('meta[name="viewport"]', 'content'),
      headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => ({
        level: h.tagName.toLowerCase(),
        text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300),
      })),
      links,
      forms,
      jsonLd,
    };
  });

  return {
    url: page.url(),
    status,
    ...evidence,
  };
}

export async function crawlSite(inputUrl, maxPages = DEFAULT_MAX_PAGES) {
  const input = validateSiteCheckInput(inputUrl, maxPages);
  const results = [];
  const queueName = `sitecheck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requestQueue = await RequestQueue.open(queueName);

  const crawler = new PlaywrightCrawler({
    requestQueue,
    maxRequestsPerCrawl: input.maxPages,
    maxConcurrency: 3,

    async requestHandler({ page, request, response, enqueueLinks }) {
      const depth = Number(request.userData?.depth ?? 0);
      const evidence = await capturePageEvidence(page, response);

      results.push({
        ...evidence,
        depth,
      });

      if (depth < MAX_CRAWL_DEPTH) {
        await enqueueLinks({
          strategy: 'same-hostname',
          transformRequestFunction: (nextRequest) => {
            nextRequest.userData = {
              ...nextRequest.userData,
              depth: depth + 1,
            };

            return nextRequest;
          },
        });
      }
    },

    async failedRequestHandler({ request }) {
      results.push({
        url: request.url,
        status: null,
        crawlError: request.errorMessages?.at(-1) || 'Request failed',
      });
    },
  });

  try {
    await crawler.run([{
      url: input.url,
      userData: { depth: 0 },
    }]);
    return {
      requestedUrl: input.url,
      pagesChecked: results.length,
      pages: results,
    };
  } finally {
    await requestQueue.drop();
  }
}
