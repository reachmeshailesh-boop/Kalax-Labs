# Kalax Crawl

A small, local-first website crawler built with Crawlee and Playwright.

Kalax Crawl takes a starting URL, follows same-host links up to a page limit, shows crawl progress in real time, and exports results as CSV or JSON.

Built by **Kalax Enterprises** as **Kalax Labs #001**.

## Features

- Same-host website crawling
- Configurable page limit
- Live browser progress
- URL, title, and status results
- CSV and JSON downloads
- Command-line interface
- Local-first operation
- No API key or cloud account

## Requirements

- Node.js 22 or newer
- npm
- Playwright Chromium

## Install

```bash
git clone <REPOSITORY-URL>
cd Kalax-Labs/kalax-crawl
npm install
npx playwright install chromium
```

The real repository URL will replace `<REPOSITORY-URL>` when the project is published.

## Web interface

Start Kalax Crawl:

```bash
npm run web
```

Then open `http://127.0.0.1:4173` in your browser.

Enter a website URL, choose the maximum number of pages, and start the crawl.

## Command line

```bash
npm run crawl -- https://example.com 10
```

CLI results are written to:

```text
output/crawl-results.json
output/crawl-results.csv
```

## Result format

Each crawled page contains a URL, page title, and status.

## Verify

Run the complete verification harness:

```bash
npm run verify
```

The verification suite covers input validation, exports, browser crawling, repeated-crawl isolation, bounded recursive crawling, same-host boundaries, the JSON API, live SSE events, and invalid-input handling.

The integration tests access public websites, so an internet connection is required.

## Architecture

Kalax Crawl deliberately uses a small architecture:

```text
Browser
   |
   | HTTP / SSE
   v
Node HTTP server
   |
   v
Crawlee + Playwright
   |
   v
Isolated per-crawl request queue
```

Each crawl uses an isolated temporary request queue, so repeating the same URL does not inherit request state from an earlier run.

## Useful commands

```bash
npm run web
npm run crawl -- https://example.com 10
npm test
npm run verify
```

## Scope

Kalax Crawl V1 intentionally does not include AI analysis, cloud crawling, accounts, proxies, scheduling, databases, authentication, or billing.

The project is deliberately small and designed to be easy to run, inspect, and modify.

## Responsible use

Only crawl websites you are permitted to access. Respect applicable site policies, terms, rate limits, and legal requirements.

Users are responsible for how they use Kalax Crawl.

## License

MIT. See `LICENSE`.

## Kalax Labs

Kalax Labs is a series of small, useful, open-source software experiments from **Kalax Enterprises**.

**Kalax Labs #001 — Kalax Crawl**
