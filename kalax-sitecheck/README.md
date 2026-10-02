# Kalax SiteCheck

A local-first website evidence checker built with Crawlee and Playwright.

Give SiteCheck a business website. It checks what customers, search systems, and machines can actually understand from the site and shows evidence for every finding.

Built by **Kalax Enterprises** as **Kalax Labs #002**.

## What it checks

SiteCheck V1 evaluates 12 evidence-backed checks across four areas:

- Customer Reachability
- Search & Crawl
- Business Identity
- Machine Readability

Checks include site reachability, broken paths, page identification, canonical setup, contact and enquiry routes, mobile basics, business identity markup, identity consistency, structured data, content structure, and external identity references.

SiteCheck does not produce an arbitrary overall SEO, GEO, or AI score.

Each finding uses one of four statuses:

- `PASS` — sufficient positive evidence was found
- `NEEDS_ATTENTION` — a concrete issue is worth examining
- `FAIL` — an objectively testable failure was found
- `NOT_VERIFIED` — the check could not be established reliably

Unknown evidence is not treated as a failure or as zero.

## Features

- Local-first execution
- Same-host website crawling
- Maximum 20 pages
- Bounded crawl depth
- 12 deterministic evidence checks
- Customer-readable grouped results
- Downloadable PDF report
- JSON evidence export
- No API key
- No cloud account
- No AI service
- No database

## Requirements

- Node.js 22 or newer
- npm
- Playwright Chromium

## Install

Clone the repository, enter kalax-sitecheck, run npm install, then install Playwright Chromium.

## Run

Start SiteCheck with npm run web, then open the local address shown by the server.

## Test

Run npm test.

The deterministic suite covers detector semantics, input limits, bounded crawling, the depth boundary, HTTP failure handling, and preservation of NOT_VERIFIED when evidence is insufficient.

## Evidence model

SiteCheck is evidence-first. Findings connect a claim to evidence, affected URLs, why it matters, and a suggested action.

## Scope

SiteCheck V1 intentionally excludes AI/LLM analysis, API keys, simulated ChatGPT searches, recommendation claims, competitor citation analysis, keyword rankings, accounts, authentication, databases, credits, billing, monitoring, history, and cloud crawling.

## Responsible use

Only check websites you are permitted to access. Respect applicable site policies, terms, rate limits, and legal requirements.

Users are responsible for how they use SiteCheck.

## License

MIT. See LICENSE.

## Kalax Labs

Kalax Labs is a series of small, useful, open-source software experiments from Kalax Enterprises.

Kalax Labs #002 — Kalax SiteCheck
