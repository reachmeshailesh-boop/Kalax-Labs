// Every failure that can reach a browser is an ExtractError with a fixed,
// human-readable message. Raw provider payloads, stack traces and prompts
// never travel through this type.

const CATALOG = {
    UNSUPPORTED_TYPE: [
        415,
        'Please upload a JPEG, PNG or WebP image.',
    ],
    TOO_LARGE: [
        413,
        'This image is too large. Please use a photo under the size limit.',
    ],
    EMPTY_UPLOAD: [
        400,
        'No image was received. Please choose a photo of one handwritten page.',
    ],
    UNREADABLE: [
        422,
        "We couldn't confidently read enough of this note. Try taking another photo in better lighting with the entire page visible.",
    ],
    PROVIDER_BAD_RESPONSE: [
        502,
        "We couldn't produce a reliable report from this image. Please try again.",
    ],
    PROVIDER_TIMEOUT: [
        504,
        'The reading service took too long to respond. Please try again.',
    ],
    PROVIDER_UNAVAILABLE: [
        503,
        'The reading service is temporarily unavailable. Please try again shortly.',
    ],
    PROVIDER_RATE_LIMITED: [
        429,
        'The reading service is busy right now. Please try again in a few minutes.',
    ],
    NOT_CONFIGURED: [
        503,
        'This demo is not fully configured yet. Please try again later.',
    ],
    RATE_LIMITED: [
        429,
        'Too many extractions from this connection. Please wait a while and try again.',
    ],
    NOT_FOUND: [
        404,
        'Not found.',
    ],
    METHOD_NOT_ALLOWED: [
        405,
        'Method not allowed.',
    ],
    INTERNAL: [
        500,
        'Something went wrong on our side. Please try again.',
    ],
};

export class ExtractError extends Error {
    constructor(code) {
        const entry = CATALOG[code] ?? CATALOG.INTERNAL;

        super(entry[1]);

        this.name = 'ExtractError';
        this.code = CATALOG[code] ? code : 'INTERNAL';
        this.status = entry[0];
    }
}

// Collapse anything thrown anywhere into an ExtractError. Unknown errors
// become INTERNAL; their detail is intentionally dropped.
export function toExtractError(error) {
    return error instanceof ExtractError
        ? error
        : new ExtractError('INTERNAL');
}
