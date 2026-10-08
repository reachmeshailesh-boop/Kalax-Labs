import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JPEG, config, post, startServer } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const listFiles = (dir) =>
    readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );

test('project structure is complete', () => {
    for (const file of [
        'package.json', 'LICENSE', 'README.md', '.env.example', '.gitignore',
        'src/server.mjs', 'src/extract.mjs', 'src/schema.mjs', 'src/csv.mjs', 'src/guard.mjs',
        'src/providers/mock.mjs', 'src/providers/gemini.mjs', 'src/providers/fixtures.mjs',
        'public/index.html', 'public/app.js', 'public/styles.css',
        'scripts/verify.mjs', 'scripts/acceptance.mjs',
        'docs/acceptance/README.md', 'docs/acceptance/dataset/manifest.json',
        'docs/acceptance/dataset/ground-truth/_template.json',
    ]) {
        assert.ok(existsSync(path.join(root, file)), file);
    }
});

test('package: Node 22+, ESM, verify script, zero runtime dependencies, MIT', () => {
    const pkg = JSON.parse(read('package.json'));

    assert.match(pkg.engines.node, />=22/);
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.scripts.verify, 'node scripts/verify.mjs');
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies, undefined);
    assert.equal(pkg.license, 'MIT');
    assert.match(read('LICENSE'), /^MIT License/);
});

test('.env.example documents the contract and contains no credential', () => {
    const env = read('.env.example');

    assert.match(env, /^GEMINI_API_KEY=$/m, 'key is blank');
    assert.match(env, /^GEMINI_MODEL=\S+$/m);
    assert.match(env, /^EXTRACT_PROVIDER=mock$/m);
    assert.doesNotMatch(env, /AIza[0-9A-Za-z_-]{20,}/);
});

test('no API key material in any browser-delivered asset or the config endpoint', async () => {
    const pattern = /GEMINI|AIza|x-goog|googleapis|api[_-]?key|process\.env/i;

    for (const file of listFiles('public')) {
        assert.doesNotMatch(readFileSync(path.join(root, file), 'utf8'), pattern, file);
    }

    const app = await startServer({
        config: config({ EXTRACT_PROVIDER: 'gemini', GEMINI_API_KEY: 'AIzaSyDUMMYKEYFORTEST123456789', GEMINI_MODEL: 'secret-model-name' }),
    });

    try {
        for (const route of ['/', '/app.js', '/index.html', '/styles.css', '/api/config', '/api/health']) {
            const text = await (await fetch(`${app.base}${route}`)).text();

            assert.doesNotMatch(text, /AIzaSyDUMMY|secret-model-name/, route);
        }
    } finally {
        await app.close();
    }
});

test('no persistence: no storage or database code anywhere', () => {
    const forbidden = /writeFile|createWriteStream|appendFile|mkdir|rename\(|unlink|sqlite|mongo|redis|better-sqlite|from 'pg'|prisma|localStorage|sessionStorage|indexedDB/i;

    for (const file of [...listFiles('src'), ...listFiles('public')]) {
        assert.doesNotMatch(readFileSync(path.join(root, file), 'utf8'), forbidden, file);
    }
});

test('no persistence at runtime: extracting leaves the project tree unchanged', async () => {
    const snapshot = () =>
        listFiles('.')
            .filter((file) => !file.startsWith('node_modules'))
            .map((file) => `${file}:${statSync(path.join(root, file)).size}:${statSync(path.join(root, file)).mtimeMs}`)
            .sort()
            .join('\n');

    const app = await startServer({ config: config() });
    const before = snapshot();

    try {
        await post(app.base, JPEG, { fixture: 'clean-meeting' });
        await post(app.base, JPEG, { fixture: 'unusable-image' });
    } finally {
        await app.close();
    }

    assert.equal(snapshot(), before);
});

test('client has CSV download and no JSON download surface', () => {
    const html = read('public/index.html');
    const js = read('public/app.js');

    assert.match(html, /Download CSV/);
    assert.doesNotMatch(html + js, /Download JSON|\.json['"`]|application\/json|JSON\.stringify/i);
    assert.match(js, /text\/csv/);
});

test('client renders untrusted note content without innerHTML', () => {
    assert.doesNotMatch(read('public/app.js'), /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
});

test('visible report contract: sections, action columns, em dash, collapsed transcription, CTA', () => {
    const js = read('public/app.js');
    const html = read('public/index.html');

    for (const heading of ['Summary', 'Key Points', 'Decisions', 'Action Items', 'People Mentioned', 'Dates & Numbers', 'Needs Review']) {
        assert.ok(js.includes(`'${heading}'`), heading);
    }

    assert.match(js, /\['Action', 'Owner', 'Due'\]/);
    assert.match(js, /MISSING = '—'/);
    assert.match(js, /el\('details'\)/);
    assert.doesNotMatch(js, /details\.open|setAttribute\('open'/);
    assert.match(js, /items? needs? review|items need review/);
    assert.match(html, /What if this understood your documents\?/);
    assert.match(html, /Build this for my organisation →/);
});

test('commercial boundary: no excluded feature is offered in the UI', () => {
    const html = read('public/index.html').toLowerCase();

    for (const word of ['batch', 'pdf', 'api access', 'dashboard', 'sign in', 'log in', 'history']) {
        assert.ok(!html.includes(word), word);
    }

    assert.equal((html.match(/type="file"/g) ?? []).length, 2, 'single-image pickers only');
    assert.doesNotMatch(html, /multiple/);
});

test('acceptance dataset contract is prepared and honestly PENDING', () => {
    const manifest = JSON.parse(read('docs/acceptance/dataset/manifest.json'));

    assert.equal(manifest.status, 'PENDING');
    assert.deepEqual(manifest.images, [], 'no fabricated images or results');
    assert.deepEqual(Object.keys(manifest.categories), ['A', 'B', 'C', 'D', 'E', 'N']);
    assert.equal(['A', 'B', 'C', 'D', 'E'].reduce((n, k) => n + manifest.categories[k].planned, 0), 20);

    const template = JSON.parse(read('docs/acceptance/dataset/ground-truth/_template.json'));

    for (const key of ['transcription', 'criticalNames', 'criticalNumbers', 'criticalDates', 'decisions', 'actions', 'ambiguous']) {
        assert.ok(key in template, key);
    }

    const doc = read('docs/acceptance/README.md');

    for (const threshold of ['≥ 95%', '≥ 90%', '100%']) assert.ok(doc.includes(threshold), threshold);

    assert.match(doc, /Status: PENDING/);
    assert.deepEqual(readdirSync(path.join(root, 'docs/acceptance/dataset/ground-truth')), ['_template.json']);
});

test('README covers the required topics and avoids forbidden claims', () => {
    const readme = read('README.md');

    for (const topic of [
        /problem/i, /architecture/i, /local setup|## Run/i, /mock mode/i, /Gemini mode/i,
        /privacy/i, /limitations/i, /CSV/, /acceptance/i, /commercial boundary|what the demo excludes/i,
        /manually uploading one image/i,
    ]) {
        assert.match(readme, topic, String(topic));
    }

    assert.doesNotMatch(readme, /never leaves the server|provider (retains|stores) nothing|nothing is (retained|stored) anywhere/i);
    assert.match(readme, /PENDING/);
});

test('sibling projects are untouched', () => {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const siblings = ['kalax-crawl', 'kalax-sitecheck'];

    // Uncommitted changes (also covers shallow clones without a base branch).
    for (const sibling of siblings) {
        assert.equal(git('status', '--porcelain', '--', `../${sibling}`), '', `${sibling} has working-tree changes`);
    }

    let base = '';

    for (const ref of ['main', 'origin/main']) {
        try { base = git('merge-base', 'HEAD', ref); break; } catch { /* try next */ }
    }

    if (!base) return;

    for (const sibling of siblings) {
        assert.equal(git('diff', '--name-only', base, 'HEAD', '--', `../${sibling}`), '', `${sibling} differs from base`);
    }
});
