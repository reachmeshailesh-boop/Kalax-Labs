import { ExtractError } from './errors.mjs';

export const REPORT_KEYS = Object.freeze([
    'title',
    'summary',
    'keyPoints',
    'decisions',
    'actions',
    'people',
    'datesAndNumbers',
    'needsReview',
    'transcription',
]);

const STRING_FIELDS = ['title', 'summary', 'transcription'];
const LIST_FIELDS = ['keyPoints', 'decisions', 'people', 'datesAndNumbers', 'needsReview'];
const ACTION_KEYS = ['action', 'owner', 'due'];

const MAX_ITEMS = 100;
const MAX_TEXT = 20_000;
const MAX_ITEM = 1_000;

function bad() {
    throw new ExtractError('PROVIDER_BAD_RESPONSE');
}

function hasExactKeys(value, keys) {
    const actual = Object.keys(value);

    return (
        actual.length === keys.length &&
        keys.every((key) => actual.includes(key))
    );
}

function text(value, limit) {
    if (typeof value !== 'string' || value.length > limit) bad();

    return value.trim();
}

// Strict: exact key set, exact types, bounded sizes. Anything else is
// rejected rather than repaired, so malformed output can never be shown.
export function validateReport(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) bad();
    if (!hasExactKeys(input, REPORT_KEYS)) bad();

    const report = {};

    for (const field of STRING_FIELDS) {
        report[field] = text(input[field], MAX_TEXT);
    }

    for (const field of LIST_FIELDS) {
        const list = input[field];

        if (!Array.isArray(list) || list.length > MAX_ITEMS) bad();

        report[field] = list
            .map((item) => text(item, MAX_ITEM))
            .filter((item) => item !== '');
    }

    if (!Array.isArray(input.actions) || input.actions.length > MAX_ITEMS) bad();

    report.actions = input.actions
        .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) bad();
            if (!hasExactKeys(item, ACTION_KEYS)) bad();

            return {
                action: text(item.action, MAX_ITEM),
                owner: text(item.owner, MAX_ITEM),
                due: text(item.due, MAX_ITEM),
            };
        })
        .filter((item) => item.action !== '');

    return Object.freeze(report);
}

// JSON schema handed to a provider that supports structured output.
export const REPORT_JSON_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        actions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    action: { type: 'string' },
                    owner: { type: 'string' },
                    due: { type: 'string' },
                },
                required: ACTION_KEYS,
            },
        },
        people: { type: 'array', items: { type: 'string' } },
        datesAndNumbers: { type: 'array', items: { type: 'string' } },
        needsReview: { type: 'array', items: { type: 'string' } },
        transcription: { type: 'string' },
    },
    required: REPORT_KEYS,
});
