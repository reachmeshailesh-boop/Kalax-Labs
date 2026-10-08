// Real-handwriting acceptance tooling. Needs real images and a live Gemini
// run to produce a real verdict; see docs/acceptance/README.md.
//
//   node scripts/acceptance.mjs status
//   node scripts/acceptance.mjs run http://127.0.0.1:3010
//   node scripts/acceptance.mjs score

import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRun } from '../src/acceptance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/acceptance/dataset');
const truthDir = path.join(root, 'ground-truth');
const resultsFile = path.join(root, 'results', 'run.json');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

async function loadTruth() {
    if (!existsSync(truthDir)) return [];

    const files = readdirSync(truthDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

    return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(truthDir, f), 'utf8'))));
}

const [command, target] = process.argv.slice(2);
const truths = await loadTruth();
const ready = truths.filter((t) => existsSync(path.join(root, t.image)));

if (command === 'status' || !command) {
    console.log(`ACCEPTANCE=PENDING (${ready.length} of 24 planned images present with ground truth)`);
} else if (command === 'run') {
    if (ready.length === 0) {
        console.log('ACCEPTANCE=PENDING (no real images with ground truth present)');
        process.exit(0);
    }

    if (!target) throw new Error('Usage: acceptance.mjs run <base-url>');

    const entries = [];

    for (const truth of ready) {
        const file = path.join(root, truth.image);
        const response = await fetch(`${target}/api/extract`, {
            method: 'POST',
            headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] },
            body: await readFile(file),
        });
        const body = await response.json();

        const code = body.error?.code;

        // Infrastructure problems say nothing about quality; do not record them.
        if (!response.ok && code !== 'UNREADABLE' && code !== 'PROVIDER_BAD_RESPONSE') {
            throw new Error(`Run aborted on ${truth.id}: ${code}. Fix the environment and rerun.`);
        }

        entries.push(
            response.ok
                ? { truth, outcome: 'report', report: body.report, csv: body.csv }
                : { truth, outcome: code === 'UNREADABLE' ? 'safe_failure' : 'schema_invalid' },
        );
    }

    await mkdir(path.dirname(resultsFile), { recursive: true });
    await writeFile(resultsFile, JSON.stringify(entries, null, 2));
    console.log(`Recorded ${entries.length} results. Run "score" next.`);
} else if (command === 'score') {
    if (!existsSync(resultsFile)) {
        console.log('ACCEPTANCE=PENDING (no recorded run)');
        process.exit(0);
    }

    const { verdict, metrics, results } = scoreRun(JSON.parse(await readFile(resultsFile, 'utf8')));

    console.log(JSON.stringify({ metrics, results }, null, 2));
    console.log(`ACCEPTANCE=${verdict}`);
} else {
    throw new Error(`Unknown command: ${command}`);
}
