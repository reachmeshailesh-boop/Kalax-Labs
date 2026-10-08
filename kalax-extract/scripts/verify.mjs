import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const listJs = (dir) =>
    readdirSync(path.join(root, dir), { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(mjs|js)$/.test(entry.name))
        .map((entry) => path.join(dir, entry.name));

const sources = [
    ...listJs('src'),
    ...listJs('src/providers'),
    ...listJs('public'),
    ...listJs('scripts'),
    ...listJs('test'),
];

function run(name, args) {
    return new Promise((resolve, reject) => {
        console.log(`\n=== ${name.toUpperCase()} ===`);

        const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });

        child.once('error', reject);
        child.once('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${name} failed with exit code ${code}`));
        });
    });
}

try {
    for (const file of sources) {
        await run(`syntax ${file}`, ['--check', file]);
    }

    const tests = listJs('test').filter((file) => file.endsWith('.test.mjs'));

    await run('automated tests', ['--test', '--test-concurrency=1', ...tests]);

    console.log('\nKalax Extract verification passed (mock provider; real Gemini and real-handwriting acceptance remain PENDING).');
} catch (error) {
    console.error(`\nVerification failed: ${error.message}`);
    process.exit(1);
}
