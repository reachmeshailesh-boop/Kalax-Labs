import { createHash } from 'node:crypto';
import { DEFAULT_POOL, FIXTURES } from './fixtures.mjs';

// Deterministic provider: same bytes (or same explicit hint) always yields
// the same raw output. It returns raw output only; validation happens in the
// shared pipeline.
export function createMockProvider() {
    return {
        name: 'mock',
        async extract({ bytes, hint }) {
            const name =
                hint && Object.hasOwn(FIXTURES, hint)
                    ? hint
                    : DEFAULT_POOL[
                          createHash('sha256').update(bytes).digest().readUInt32BE(0) %
                              DEFAULT_POOL.length
                      ];

            return structuredClone(FIXTURES[name]);
        },
    };
}
