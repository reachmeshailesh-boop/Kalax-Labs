import { ExtractError } from './errors.mjs';

export const ALLOWED_MIME = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

// Identify the real format from magic bytes. The declared Content-Type is
// only a hint and is never trusted on its own.
export function sniffMime(bytes) {
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ) {
        return 'image/jpeg';
    }

    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
        bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
        bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
        return 'image/png';
    }

    if (
        bytes.length >= 12 &&
        bytes.toString('latin1', 0, 4) === 'RIFF' &&
        bytes.toString('latin1', 8, 12) === 'WEBP'
    ) {
        return 'image/webp';
    }

    return null;
}

export function validateUpload({ bytes, contentType, maxBytes }) {
    if (!bytes || bytes.length === 0) {
        throw new ExtractError('EMPTY_UPLOAD');
    }

    if (bytes.length > maxBytes) {
        throw new ExtractError('TOO_LARGE');
    }

    const declared = String(contentType || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

    if (!ALLOWED_MIME.includes(declared)) {
        throw new ExtractError('UNSUPPORTED_TYPE');
    }

    const actual = sniffMime(bytes);

    if (actual !== declared) {
        throw new ExtractError('UNSUPPORTED_TYPE');
    }

    return { mime: actual };
}
