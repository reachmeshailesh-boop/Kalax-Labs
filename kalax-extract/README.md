# Kalax Extract

Turn handwritten business notes into structured, actionable information.

Upload one photo of one handwritten page. Kalax Extract returns a structured
report — summary, key points, decisions, an action table, people, dates and
numbers — keeps anything uncertain visible instead of guessing, and lets you
download the result as CSV.

Built by **Kalax Enterprises** as **Kalax Labs #003**.

> **Status.** The application and its verification suite are complete and run
> end to end with a deterministic mock provider. The real Gemini provider is
> implemented but has **not** been exercised against live inference, and the
> real-handwriting acceptance suite is **PENDING**. Nothing in this repository
> claims real-world reading accuracy. See [Acceptance methodology](#acceptance-methodology).

## The problem

Handwritten notes hold decisions, owners and deadlines, and they stay on paper.
The hard part is not reading them. It is turning them into something a
business can rely on, without a tool quietly inventing a name, a date or an
amount along the way.

## What this demo is for

It proves one capability: **one handwritten page → a structured report →
uncertainty preserved → CSV.** It is deliberately not a full enterprise
workflow product. See [Commercial boundary](#commercial-boundary).

## What it does

- Accepts exactly one JPEG, PNG or WebP image (file upload, or camera/photo selection on mobile)
- Makes one multimodal request per extraction; the image goes straight to the model, with no separate OCR step
- Validates the model output against a strict schema and rejects malformed output
- Shows: Summary, Key Points, Decisions, Action Items (Action / Owner / Due), People Mentioned, Dates & Numbers, Needs Review, and a collapsed Transcription
- Shows a missing owner or deadline as `—`
- Reports partial success ("3 items need review") rather than failing the whole page
- Fails safely on unreadable images, with plain-language guidance
- Generates the CSV deterministically from the validated result

## Fidelity contract

The system may organise information that is on the page. It must not invent
names, owners, deadlines, dates, amounts, numbers, decisions or actions.

- "Call Amit Friday" → action `Call Amit`, due `Friday`, owner empty
- "Discuss quotation" stays "Discuss quotation". It does not become "Send quotation to customer by Friday".
- No owner → `owner = ""`. No deadline → `due = ""`.
- Anything illegible or ambiguous goes into **Needs Review**.

Two layers enforce this:

1. **The instruction** sent to the model (server-side only) forbids inference and asks it to flag uncertainty.
2. **A deterministic guard** runs on every result. Any name or figure that does not appear in the model's own transcription is removed and listed under Needs Review, never silently dropped.

The guard is a backstop, not proof. It cannot catch a plausible mistake that
the transcription itself contains. That is what the acceptance suite is for.

## Architecture

```
browser ── POST image bytes ──▶ server
                                  │ 1. rate limit           (in memory)
                                  │ 2. size cap while reading
                                  │ 3. MIME check, confirmed by magic bytes
                                  │ 4. provider (mock | gemini), with timeout
                                  │ 5. strict schema validation
                                  │ 6. fidelity guard
                                  │ 7. readability check
                                  │ 8. CSV from the validated report
browser ◀── { report, csv, reviewCount } or a safe error
```

| Path | Role |
| --- | --- |
| `src/server.mjs` | HTTP server, static files, security headers |
| `src/extract.mjs` | The single pipeline both providers go through |
| `src/schema.mjs` | Strict internal result schema |
| `src/guard.mjs` | Deterministic fidelity guard |
| `src/csv.mjs` | Deterministic CSV |
| `src/providers/` | `mock` (fixtures) and `gemini` |
| `src/errors.mjs` | The only error messages a browser can receive |
| `public/` | Static client; contains no secrets |

Zero runtime dependencies. Node 22 or newer.

## Local setup

```sh
cd kalax-extract
cp .env.example .env     # optional; mock mode needs nothing
npm start                # http://127.0.0.1:3010
npm run verify
```

`npm start` reads the process environment. Load a `.env` with your shell or
process manager (for example `node --env-file=.env src/server.mjs`).

## Mock mode

`EXTRACT_PROVIDER=mock` is the default. No API key and no network call.

The mock returns deterministic fixtures: a clean meeting note, an action with
owner and deadline, a missing owner, a missing deadline, ambiguous handwriting,
names and money, no decisions, a partial extraction, an unusable image, and a
malformed provider response. In mock mode the page shows a fixture selector.
Without a selection, a fixture is chosen deterministically from the image
bytes.

Fixtures are **raw provider output**. They travel through the same upload
validation, schema validation, guard, readability check and CSV generation as
live output. Mock mode demonstrates the pipeline. It does not demonstrate that
any model can read handwriting.

## Future Gemini mode

```sh
EXTRACT_PROVIDER=gemini
GEMINI_API_KEY=<your key, server-side only>
GEMINI_MODEL=<configurable model id>
```

The key is read on the server and sent to Google in a request header. It is
never placed in client code, API responses or error messages. If Gemini is
selected without configuration, the server keeps running and extractions
return a generic "not fully configured" message.

Status: implemented and tested against a stubbed `fetch`; **not yet run against
the live API.**

## Privacy boundary

Kalax does not intentionally persist the uploaded image or the extracted
report after processing. There is no database, no account, no history, and no
code that writes uploads or results to disk.

When the Gemini provider is used, the image is sent to an external inference
provider. That processing is a separate boundary governed by the provider's
own terms. This project makes no claim about how the provider handles data.
Review the provider's terms before using real business notes.

Infrastructure outside this code (reverse-proxy logs, host backups) is outside
this claim too.

## Public demo guardrails

- Server-side MIME validation, confirmed against file signatures
- Conservative size limit (default 4 MB, `EXTRACT_MAX_IMAGE_BYTES`)
- Request timeout (default 30 s, `EXTRACT_TIMEOUT_MS`)
- In-memory rate limit per client (default 10 per hour, `EXTRACT_RATE_LIMIT`, `EXTRACT_RATE_WINDOW_MS`). Set `EXTRACT_TRUST_PROXY=1` only behind a proxy you control.
- No arbitrary prompt input; the instruction is fixed on the server
- Safe errors only: no stack traces, provider payloads, keys or prompts reach the browser
- The browser downsizes an oversized photo before upload

## CSV behaviour

Columns: `section, item, owner, due`. One row per displayed item: title,
summary, each key point, decision, action, person, date or number, review item,
and the transcription.

- Generated from the validated report only. No second AI call.
- Missing owner or deadline is an empty cell.
- Quotes, commas and line breaks are escaped (RFC 4180).
- Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return get a leading `'` so spreadsheets treat note content as text and not as a formula.
- There is no JSON download.

## Limitations

- One image per request. No PDFs, multi-page input or batches.
- Handwriting reading quality is unmeasured on real pages (acceptance is pending).
- The guard checks names and figures against the transcription. It does not verify dates written as words, or meaning.
- The rate limiter is per process and resets on restart.
- The model may mis-transcribe confidently. Treat the report as a draft, and check anything under Needs Review against the original page.

## Acceptance methodology

Automated tests (`npm run verify`) prove the pipeline using mock fixtures and a
stubbed Gemini transport. They are not an accuracy claim.

Accuracy is defined in [docs/acceptance](docs/acceptance/README.md): 20 real
handwritten pages across five categories (clean, messy, annotated, difficult
photography, deliberately ambiguous) plus 4 negative controls, each with human
ground truth. CTQs:

| CTQ | Threshold |
| --- | --- |
| Critical names / numbers / dates correct | ≥ 95% |
| Explicit actions identified | ≥ 90% |
| Fabricated critical facts | 0 |
| Invented missing information | 0 |
| Deliberately ambiguous items flagged | ≥ 90% |
| Valid structured response | 100% |
| CSV matches validated report | 100% |
| Bad / unusable image fails safely | 100% |

**Status: PENDING.** It stays PENDING until real images and real Gemini
inference have been tested. `node scripts/acceptance.mjs status` reports this.

## Commercial boundary

The demo intentionally excludes batch processing, PDFs, invoices and forms,
custom extraction schemas, organisation-specific terminology, CRM / ERP /
Google Sheets integrations, workflow automation, team accounts, dashboards,
persistent history, approval workflows, private or on-premises deployment, and
public API access.

Those are what turn a capability into a deployed system. Kalax can adapt this
to your forms, reports and workflows and connect the results to the systems
your organisation already uses.

## Why this differs from manually uploading one image to a general AI assistant

You can, and for a single note that may be exactly right. General AI assistants
are capable products, and the underlying AI capability may be available
generally.

What Kalax demonstrates is how that capability becomes a controlled,
repeatable business workflow: defined outputs, validation, uncertainty
handling and integration potential. The same fields appear every time, malformed
output is rejected, missing owners and dates stay missing, uncertainty is
surfaced rather than smoothed over, and the result is something a downstream
system can consume.

## Tests

`npm run verify` runs syntax checks and the full automated suite: upload
validation, schema, malformed output, missing owner/deadline, uncertainty, CSV
escaping and report equivalence, rate limiting, safe errors, the Gemini
configuration guard, absence of persistence and of key material in client
assets, and that sibling projects are untouched.

## License

MIT. See LICENSE.

## Kalax Labs

Kalax Labs is a series of small, useful, open-source software experiments from Kalax Enterprises.

Kalax Labs #003 — Kalax Extract
