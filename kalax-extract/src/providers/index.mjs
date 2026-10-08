import { createGeminiProvider } from './gemini.mjs';
import { createMockProvider } from './mock.mjs';

export function createProvider(config, { fetchImpl } = {}) {
    if (config.provider === 'gemini') {
        return createGeminiProvider({
            apiKey: config.geminiApiKey,
            model: config.geminiModel,
            timeoutMs: config.timeoutMs,
            fetchImpl,
        });
    }

    return createMockProvider();
}
