import { validateReport } from './schema.mjs';

// Deterministic backstop against invented facts. It cannot prove fidelity,
// but it removes the most damaging fabrications: names and figures that do
// not appear anywhere in the model's own transcription. Removed material is
// never dropped silently — it is listed in needsReview.

const NUMBER_RUN = /\d[\d,.]*/g;

function squash(value) {
    return value.toLowerCase().replace(/\s+/g, ' ');
}

function numbersIn(value) {
    return (value.match(NUMBER_RUN) ?? [])
        .map((run) => run.replace(/[,.]+$/, '').replaceAll(',', ''))
        .filter(Boolean);
}

function wordsIn(value) {
    return squash(value).match(/[\p{L}][\p{L}'’-]+/gu) ?? [];
}

export function applyFidelityGuard(report) {
    const transcription = squash(report.transcription);
    const knownNumbers = new Set(numbersIn(report.transcription));
    const knownWords = new Set(wordsIn(report.transcription));
    const flags = [];

    const unknownNumber = (value) =>
        numbersIn(value).find((number) => !knownNumbers.has(number));

    const unknownName = (value) =>
        wordsIn(value).find((word) => !knownWords.has(word));

    const checkText = (value, label) => {
        const number = unknownNumber(value);

        if (number === undefined) return true;

        flags.push(`Removed ${label} containing "${number}", which is not in the transcription: ${value}`);

        return false;
    };

    const checkName = (value, label) => {
        if (value === '') return true;

        const word = unknownName(value);

        if (word === undefined) return true;

        flags.push(`Removed ${label} "${value}" because "${word}" is not in the transcription.`);

        return false;
    };

    const next = {
        ...report,
        keyPoints: report.keyPoints.filter((item) => checkText(item, 'key point')),
        decisions: report.decisions.filter((item) => checkText(item, 'decision')),
        people: report.people.filter((item) => checkName(item, 'name')),
        datesAndNumbers: report.datesAndNumbers.filter((item) => {
            const number = unknownNumber(item);

            if (number === undefined) return true;

            flags.push(`Removed figure "${item}" because it is not in the transcription.`);

            return false;
        }),
        actions: report.actions
            .filter((item) => checkText(item.action, 'action'))
            .map((item) => {
                let { owner, due } = item;

                if (!checkName(owner, `owner for "${item.action}"`)) owner = '';

                if (due !== '' && unknownNumber(due) !== undefined) {
                    flags.push(`Removed deadline "${due}" for "${item.action}" because it is not in the transcription.`);
                    due = '';
                }

                return { action: item.action, owner, due };
            }),
        needsReview: [...report.needsReview],
    };

    if (report.summary !== '' && unknownNumber(report.summary) !== undefined) {
        flags.push('The summary contains a figure that is not in the transcription. Check it against the original note.');
    }

    // A transcription that is itself empty cannot ground anything.
    if (transcription === '' && flags.length === 0) {
        const hasClaims =
            report.keyPoints.length + report.decisions.length +
            report.actions.length + report.people.length +
            report.datesAndNumbers.length > 0;

        if (hasClaims) {
            flags.push('Content was reported without a transcription to support it. Check it against the original note.');
        }
    }

    next.needsReview.push(...flags);

    return validateReport(next);
}
