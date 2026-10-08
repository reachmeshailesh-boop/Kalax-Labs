import { ExtractError } from './errors.mjs';

function integer(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(value ?? '', 10);

    if (!Number.isFinite(parsed)) return fallback;

    return Math.min(max, Math.max(min, parsed));
}

export function loadConfig(env = process.env) {
    const provider = (env.EXTRACT_PROVIDER || 'mock').trim().toLowerCase();

    if (provider !== 'mock' && provider !== 'gemini') {
        throw new Error('EXTRACT_PROVIDER must be "mock" or "gemini".');
    }

    return Object.freeze({
        provider,
        port: integer(env.PORT, 3010, { min: 0, max: 65535 }),
        host: env.HOST || '127.0.0.1',
        geminiApiKey: (env.GEMINI_API_KEY || '').trim(),
        geminiModel: (env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim(),
        // Conservative: phone photos are routinely larger, but the client
        // downscales before upload; 4 MB keeps provider cost and VPS memory small.
        maxImageBytes: integer(env.EXTRACT_MAX_IMAGE_BYTES, 4 * 1024 * 1024, {
            min: 1024,
            max: 8 * 1024 * 1024,
        }),
        timeoutMs: integer(env.EXTRACT_TIMEOUT_MS, 30_000, {
            min: 1000,
            max: 120_000,
        }),
        rateLimit: integer(env.EXTRACT_RATE_LIMIT, 10),
        rateWindowMs: integer(env.EXTRACT_RATE_WINDOW_MS, 60 * 60 * 1000, {
            min: 1000,
        }),
        trustProxy: env.EXTRACT_TRUST_PROXY === '1',
        ctaUrl: (env.EXTRACT_CTA_URL || '').trim(),
    });
}

// Gemini selected without credentials must fail safely, not crash the server
// and not reveal which setting is missing.
export function assertProviderConfigured(config) {
    if (config.provider === 'gemini' && (!config.geminiApiKey || !config.geminiModel)) {
        throw new ExtractError('NOT_CONFIGURED');
    }
}
