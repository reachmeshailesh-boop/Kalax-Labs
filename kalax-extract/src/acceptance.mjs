import { reportToCsv } from './csv.mjs';

// Scoring for the future real-handwriting acceptance run. Pure functions:
// they score recorded results against human ground truth and never call any
// provider. With no recorded results the verdict is PENDING, not PASS.

export const THRESHOLDS = Object.freeze({
    criticalFacts: 0.95,
    explicitActions: 0.9,
    fabricatedCriticalFacts: 0,
    inventedMissingInfo: 0,
    ambiguousFlagged: 0.9,
    validStructured: 1,
    csvMatches: 1,
    badImageFailsSafely: 1,
});

const norm = (value) => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function reportText(report) {
    return norm(
        [
            report.summary,
            ...report.keyPoints,
            ...report.decisions,
            ...report.people,
            ...report.datesAndNumbers,
            ...report.actions.flatMap((a) => [a.action, a.owner, a.due]),
        ].join(' '),
    );
}

const ratio = (hit, total) => (total === 0 ? null : hit / total);

function findAction(report, truth) {
    return report.actions.find((a) => norm(a.action).includes(norm(truth.action)) || norm(truth.action).includes(norm(a.action)));
}

export function scoreRun(entries) {
    // entries: [{ truth, outcome: 'report'|'safe_failure'|'schema_invalid', report?, csv? }]
    const tally = {
        facts: [0, 0],
        actions: [0, 0],
        ambiguous: [0, 0],
        valid: [0, 0],
        csv: [0, 0],
        badImage: [0, 0],
    };
    let fabricated = 0;
    let invented = 0;

    for (const { truth, outcome, report, csv } of entries) {
        tally.valid[1] += 1;
        if (outcome !== 'schema_invalid') tally.valid[0] += 1;

        if (truth.expect === 'fail_safe') {
            tally.badImage[1] += 1;
            if (outcome === 'safe_failure') tally.badImage[0] += 1;
            continue;
        }

        if (outcome !== 'report') {
            // A safe failure on a readable page still counts as a miss.
            tally.facts[1] += truth.criticalNames.length + truth.criticalNumbers.length + truth.criticalDates.length;
            tally.actions[1] += truth.actions.length;
            tally.ambiguous[1] += truth.ambiguous.length;
            continue;
        }

        tally.csv[1] += 1;
        if (csv === reportToCsv(report)) tally.csv[0] += 1;

        const haystack = reportText(report);

        for (const fact of [...truth.criticalNames, ...truth.criticalNumbers, ...truth.criticalDates]) {
            tally.facts[1] += 1;
            if (haystack.includes(norm(fact))) tally.facts[0] += 1;
        }

        for (const expected of truth.actions) {
            tally.actions[1] += 1;

            const found = findAction(report, expected);

            if (found) tally.actions[0] += 1;
            if (found && expected.owner === '' && found.owner !== '') invented += 1;
            if (found && expected.due === '' && found.due !== '') invented += 1;
        }

        for (const item of truth.ambiguous) {
            tally.ambiguous[1] += 1;

            const flags = norm(report.needsReview.join(' '));

            if (item.flagMatch.some((token) => flags.includes(norm(token)))) tally.ambiguous[0] += 1;
        }

        // Fabrication: a reported name or figure absent from the ground-truth transcription.
        const known = norm(truth.transcription);

        for (const entry of [
            ...report.people,
            ...report.datesAndNumbers,
            ...report.actions.flatMap((a) => [a.owner, a.due]),
        ]) {
            if (entry === '') continue;

            const words = norm(entry).split(' ').filter(Boolean);

            if (words.some((word) => !known.includes(word))) fabricated += 1;
        }
    }

    const metrics = {
        criticalFacts: ratio(...tally.facts),
        explicitActions: ratio(...tally.actions),
        fabricatedCriticalFacts: fabricated,
        inventedMissingInfo: invented,
        ambiguousFlagged: ratio(...tally.ambiguous),
        validStructured: ratio(...tally.valid),
        csvMatches: ratio(...tally.csv),
        badImageFailsSafely: ratio(...tally.badImage),
    };

    const results = {};

    for (const [key, threshold] of Object.entries(THRESHOLDS)) {
        const value = metrics[key];

        if (value === null) results[key] = 'NOT_MEASURED';
        else if (key === 'fabricatedCriticalFacts' || key === 'inventedMissingInfo') {
            results[key] = value <= threshold ? 'PASS' : 'FAIL';
        } else results[key] = value >= threshold ? 'PASS' : 'FAIL';
    }

    const values = Object.values(results);
    const verdict = entries.length === 0
        ? 'PENDING'
        : values.includes('FAIL')
            ? 'FAIL'
            : values.includes('NOT_MEASURED')
                ? 'INCOMPLETE'
                : 'PASS';

    return { verdict, metrics, results };
}
