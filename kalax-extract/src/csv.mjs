// Deterministic CSV built only from an already validated report.
// One row per displayed item; empty owner/due cells mean "not stated".
// (The UI shows the same absence as an em dash.)

export const CSV_HEADER = Object.freeze(['section', 'item', 'owner', 'due']);

const SECTION_ROWS = [
    ['title', 'title'],
    ['summary', 'summary'],
    ['keyPoints', 'key_point'],
    ['decisions', 'decision'],
    ['actions', 'action'],
    ['people', 'person'],
    ['datesAndNumbers', 'date_or_number'],
    ['needsReview', 'needs_review'],
    ['transcription', 'transcription'],
];

// Cells that start with a formula trigger are prefixed with an apostrophe so
// spreadsheet software shows them as text. The note content comes from an
// untrusted image, so this matters.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value) {
    let cell = String(value ?? '');

    if (FORMULA_TRIGGER.test(cell)) cell = `'${cell}`;

    return `"${cell.replaceAll('"', '""')}"`;
}

export function reportToCsvRows(report) {
    const rows = [[...CSV_HEADER]];

    for (const [field, label] of SECTION_ROWS) {
        const value = report[field];

        if (field === 'actions') {
            for (const item of value) {
                rows.push([label, item.action, item.owner, item.due]);
            }
        } else if (Array.isArray(value)) {
            for (const item of value) rows.push([label, item, '', '']);
        } else if (value !== '') {
            rows.push([label, value, '', '']);
        }
    }

    return rows;
}

export function reportToCsv(report) {
    return (
        reportToCsvRows(report)
            .map((row) => row.map(csvCell).join(','))
            .join('\r\n') + '\r\n'
    );
}
