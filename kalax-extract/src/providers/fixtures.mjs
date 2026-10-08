// Deterministic mock outputs. Each fixture is the *raw provider output* a
// real model might return, so it must pass through the same validation,
// guard, report and CSV pipeline as live output. Fixtures are fictional.

const report = (fields) => ({
    title: '',
    summary: '',
    keyPoints: [],
    decisions: [],
    actions: [],
    people: [],
    datesAndNumbers: [],
    needsReview: [],
    transcription: '',
    ...fields,
});

export const FIXTURES = Object.freeze({
    'clean-meeting': report({
        title: 'Leadership sync',
        summary: 'Weekly leadership sync covering Q2 pricing, hiring and the supplier review.',
        keyPoints: [
            'Q2 pricing stays as is',
            'Hiring freeze continues',
            'Supplier review is the main open item',
        ],
        decisions: ['Keep Q2 pricing unchanged', 'Continue the hiring freeze'],
        transcription:
            'Leadership sync\nQ2 pricing - no change. Decided: keep as is.\nHiring freeze continues.\nSupplier review still open - main item.',
    }),

    'action-owner-deadline': report({
        title: 'Client follow-ups',
        summary: 'Two follow-ups were noted, each with an owner and a deadline.',
        keyPoints: ['Follow-ups agreed after the client call'],
        actions: [
            { action: 'Call Amit', owner: 'Priya', due: 'Friday' },
            { action: 'Send revised schedule', owner: 'Ravi', due: '14 March' },
        ],
        people: ['Amit', 'Priya', 'Ravi'],
        datesAndNumbers: ['Friday', '14 March'],
        transcription:
            'Client call follow-up\nPriya - call Amit Friday\nRavi - send revised schedule by 14 March',
    }),

    'missing-owner': report({
        title: 'Vendor notes',
        summary: 'Notes on the vendor discussion with one action that has no named owner.',
        keyPoints: ['Vendor contract discussed'],
        actions: [{ action: 'Review vendor contract', owner: '', due: 'Monday' }],
        datesAndNumbers: ['Monday'],
        transcription: 'Vendor discussion\nReview vendor contract - Monday',
    }),

    'missing-deadline': report({
        title: 'Warehouse items',
        summary: 'Warehouse follow-up where an owner is named but no deadline is written.',
        keyPoints: ['Stock count needs repeating'],
        actions: [{ action: 'Recount aisle stock', owner: 'Neha', due: '' }],
        people: ['Neha'],
        transcription: 'Warehouse\nNeha - recount aisle stock',
    }),

    'ambiguous-handwriting': report({
        title: 'Supplier call',
        summary: 'Notes from a supplier call. Several details were hard to read.',
        keyPoints: ['Supplier call took place'],
        actions: [{ action: 'Confirm order', owner: '', due: '' }],
        people: [],
        datesAndNumbers: [],
        needsReview: [
            'The name after "Call" could be "Sam" or "Sara".',
            'The amount could be 4,500 or 1,500.',
            'The date next to "Confirm order" is not legible.',
        ],
        transcription:
            'Supplier call\nCall [Sam/Sara?] re order\nAmount [4,500 or 1,500?]\nConfirm order - [illegible date]',
    }),

    'names-and-money': report({
        title: 'Budget review',
        summary: 'Budget review with named approvers and two monetary figures.',
        keyPoints: ['Marketing budget is Rs 250000', 'Contingency of Rs 40000 set aside'],
        decisions: ['Approve the marketing budget'],
        actions: [{ action: 'Release first payment', owner: 'Kavita', due: '' }],
        people: ['Kavita', 'Suresh'],
        datesAndNumbers: ['Rs 250000', 'Rs 40000'],
        transcription:
            'Budget review - Suresh, Kavita\nMarketing budget Rs 250000 - approved\nContingency Rs 40000\nKavita - release first payment',
    }),

    'no-decisions': report({
        title: 'Brainstorm',
        summary: 'Open-ended brainstorm; no decision or action was recorded.',
        keyPoints: ['Ideas for the autumn campaign', 'Customer feedback themes'],
        transcription:
            'Brainstorm\nIdeas for autumn campaign\nCustomer feedback themes\nNo conclusions yet',
    }),

    'partial-extraction': report({
        title: 'Planning note',
        summary: 'Part of this page was readable. Three items need review.',
        keyPoints: ['Launch preparation is under way'],
        decisions: [],
        actions: [{ action: 'Book venue', owner: '', due: '' }],
        needsReview: [
            'The lower third of the page is smudged and unreadable.',
            'A cross-out near the top may hide a name.',
            'The word after "Book" in the second action is unclear.',
        ],
        transcription:
            'Planning note\nLaunch prep under way\nBook venue\n[smudged]\n[cross-out]',
    }),

    // A valid but empty report: what a well-behaved model returns for a
    // blurry or blank photo when told not to guess.
    'unusable-image': report({
        needsReview: ['The image is too blurry to read.'],
        transcription: '',
    }),

    // Truncated JSON text, as a failing provider might return.
    'malformed-response': '{"title": "Broken", "summary": "Half a rep',
});

export const FIXTURE_NAMES = Object.freeze(Object.keys(FIXTURES));

// Fixtures eligible for hash-based default selection (the happy and partial
// paths). Failure fixtures are chosen only explicitly.
export const DEFAULT_POOL = Object.freeze(
    FIXTURE_NAMES.filter(
        (name) => name !== 'unusable-image' && name !== 'malformed-response',
    ),
);
