import { assertProviderConfigured } from './config.mjs';
import { reportToCsv } from './csv.mjs';
import { ExtractError } from './errors.mjs';
import { applyFidelityGuard } from './guard.mjs';
import { validateReport } from './schema.mjs';
import { validateUpload } from './upload.mjs';

const MIN_TRANSCRIPTION_CHARS = 20;

function parseProviderOutput(raw) {
    if (typeof raw !== 'string') return raw;

    try {
        return JSON.parse(raw);
    } catch {
        throw new ExtractError('PROVIDER_BAD_RESPONSE');
    }
}

// A valid but essentially empty report means the model could not read the
// page. That is a safe failure, not a result to display.
function isUnreadable(report) {
    return (
        report.keyPoints.length === 0 &&
        report.decisions.length === 0 &&
        report.actions.length === 0 &&
        report.transcription.length < MIN_TRANSCRIPTION_CHARS
    );
}

async function callWithTimeout(provider, request, timeoutMs) {
    const controller = new AbortController();
    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new ExtractError('PROVIDER_TIMEOUT'));
        }, timeoutMs);
    });

    try {
        return await Promise.race([
            provider.extract({ ...request, signal: controller.signal }),
            timeout,
        ]);
    } finally {
        clearTimeout(timer);
    }
}

// The single extraction pipeline. The mock and Gemini providers both pass
// through exactly this path: upload validation, provider call, strict schema
// validation, fidelity guard, readability check, then deterministic CSV.
export async function runExtraction({ bytes, contentType, hint }, { config, provider }) {
    const { mime } = validateUpload({
        bytes,
        contentType,
        maxBytes: config.maxImageBytes,
    });

    assertProviderConfigured(config);

    let raw;

    try {
        raw = await callWithTimeout(
            provider,
            { bytes, mime, hint },
            config.timeoutMs,
        );
    } catch (error) {
        throw error instanceof ExtractError
            ? error
            : new ExtractError('PROVIDER_UNAVAILABLE');
    }

    const report = applyFidelityGuard(validateReport(parseProviderOutput(raw)));

    if (isUnreadable(report)) throw new ExtractError('UNREADABLE');

    return {
        report,
        csv: reportToCsv(report),
        reviewCount: report.needsReview.length,
    };
}
