# Real-handwriting acceptance (V1)

**Status: PENDING.** No real images have been gathered and no live Gemini
inference has been run. The mock-provider test suite proves the pipeline
(validation, guard, report, CSV, safe failure). It says nothing about how well
any real model reads real handwriting. Do not quote it as such.

## Dataset

20 real handwritten pages plus 4 negative controls, photographed with a phone.
Use your own notes or notes whose authors agreed to their use. Images stay out
of git (`dataset/.gitignore`); ground truth and the manifest are committed.

| Category | What it tests | Planned |
| --- | --- | --- |
| A | Clean executive notes | 4 |
| B | Rushed / messy handwriting | 4 |
| C | Meeting notes with arrows, cross-outs, abbreviations | 4 |
| D | Difficult photography: angle, shadow, background | 4 |
| E | Deliberately ambiguous critical information | 4 |
| N | Negative controls: blurry, blank, non-text, unusable | 4 (extra) |

Category E pages must contain details a careful human also finds unclear
(a name that could be two names, a digit that could be two digits). The right
behaviour there is to flag, not to guess.

## Human ground truth

One JSON file per image in `dataset/ground-truth/` (see `_template.json`),
written by a person who reads the original page, ideally before seeing any
model output. It records:

- `transcription` — the page, as read by a human
- `criticalNames`, `criticalNumbers`, `criticalDates` — facts that would matter if wrong
- `decisions` — decisions actually written
- `actions` — each with `owner` and `due`; **empty string when the page does not state one**
- `ambiguous` — intentionally unclear items, each with `flagMatch` words that a
  `needsReview` entry about it would reasonably contain
- `expect` — `report` for readable pages, `fail_safe` for negative controls

## CTQs and scoring

Scoring is in `src/acceptance.mjs` (unit-tested on small synthetic inputs).

| CTQ | Threshold | How it is measured |
| --- | --- | --- |
| Critical names / numbers / dates correct | ≥ 95% | Share of ground-truth critical items found in the report |
| Explicit actions identified | ≥ 90% | Share of ground-truth actions matched by action text |
| Fabricated critical facts | 0 | Reported people, figures, owners or deadlines absent from the ground-truth transcription |
| Invented missing information | 0 | Matched actions where truth owner/due is empty but the report filled it |
| Deliberately ambiguous items flagged | ≥ 90% | Ground-truth ambiguous items matched by a `needsReview` entry |
| Valid structured response | 100% | Runs that did not end in a malformed provider response |
| CSV matches validated report | 100% | Returned CSV equals CSV regenerated from the returned report |
| Bad / unusable image fails safely | 100% | Negative controls that returned the safe "couldn't read" failure |

Scoring is automatic but conservative text matching; a human should review
every miss and every fabrication flag before drawing a conclusion.

## Running it (when credentials and images exist)

1. Put images in `dataset/images/`, write ground truth, list each in `manifest.json`.
2. Start the server with `EXTRACT_PROVIDER=gemini`, a real key in the environment,
   and `EXTRACT_RATE_LIMIT` high enough for the run.
3. `node scripts/acceptance.mjs run http://127.0.0.1:3010`
4. `node scripts/acceptance.mjs score`

The verdict is `PENDING` until real results exist, `INCOMPLETE` if a CTQ could
not be measured, and `PASS` only when every CTQ meets its threshold.
