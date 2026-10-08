import { loadConfig } from '../src/config.mjs';
import { createExtractServer } from '../src/server.mjs';

// Minimal byte strings with valid magic numbers. Content beyond the header is
// irrelevant to the mock provider, which never decodes images.
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body')]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);
export const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

export function config(env = {}) {
    return loadConfig({ EXTRACT_PROVIDER: 'mock', ...env });
}

export async function startServer(options = {}) {
    const server = createExtractServer(options);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    const base = `http://127.0.0.1:${server.address().port}`;

    return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

export function post(base, body, { type = 'image/jpeg', fixture, headers = {} } = {}) {
    return fetch(`${base}/api/extract`, {
        method: 'POST',
        headers: {
            ...(type ? { 'Content-Type': type } : {}),
            ...(fixture ? { 'X-Mock-Fixture': fixture } : {}),
            ...headers,
        },
        body,
    });
}

// Tiny RFC 4180 parser so tests do not trust the writer to check itself.
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];

        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; }
        else cell += ch;
    }

    return rows;
}
