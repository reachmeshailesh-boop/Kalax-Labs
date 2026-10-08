// Small in-memory fixed-window limiter. State is process-local and is
// deliberately never persisted.

export function createRateLimiter({ limit, windowMs, now = Date.now }) {
    const hits = new Map();

    function prune(current) {
        for (const [key, entry] of hits) {
            if (entry.resetAt <= current) hits.delete(key);
        }
    }

    return {
        take(key) {
            const current = now();

            if (hits.size > 5000) prune(current);

            let entry = hits.get(key);

            if (!entry || entry.resetAt <= current) {
                entry = { count: 0, resetAt: current + windowMs };
                hits.set(key, entry);
            }

            if (entry.count >= limit) {
                return {
                    allowed: false,
                    retryAfterSeconds: Math.ceil((entry.resetAt - current) / 1000),
                };
            }

            entry.count += 1;

            return { allowed: true, retryAfterSeconds: 0 };
        },
    };
}
