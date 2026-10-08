const $ = (id) => document.getElementById(id);

const MAX_EDGE = 2400;
const MISSING = '—';

const state = { file: null, csv: '', previewUrl: '', config: null };

function el(tag, text, className) {
    const node = document.createElement(tag);

    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;

    return node;
}

function setStatus(message) {
    $('status').textContent = message;
}

function showError(message) {
    const box = $('error');

    box.textContent = message;
    box.hidden = !message;
}

function section(title, ...children) {
    const wrapper = el('section', undefined, 'section');

    wrapper.append(el('h2', title), ...children);

    return wrapper;
}

function list(items, emptyText) {
    if (items.length === 0) return el('p', emptyText, 'empty');

    const ul = el('ul');

    for (const item of items) ul.append(el('li', item));

    return ul;
}

function cell(value) {
    const td = el('td');

    if (value === '') {
        td.append(el('span', MISSING, 'missing'));
        td.title = 'Not stated in the note';
    } else {
        td.textContent = value;
    }

    return td;
}

function actionsTable(actions) {
    if (actions.length === 0) {
        return el('p', 'No action items were written in this note.', 'empty');
    }

    const table = el('table');
    const head = el('tr');

    for (const name of ['Action', 'Owner', 'Due']) head.append(el('th', name));

    const thead = el('thead');

    thead.append(head);
    table.append(thead);

    const body = el('tbody');

    for (const item of actions) {
        const row = el('tr');

        row.append(cell(item.action), cell(item.owner), cell(item.due));
        body.append(row);
    }

    table.append(body);

    const wrap = el('div', undefined, 'table-wrap');

    wrap.append(table);

    return wrap;
}

// Rendered strictly with textContent: note content is untrusted.
function renderReport(report, reviewCount) {
    const root = $('report');

    root.replaceChildren();

    if (report.title) root.append(el('h2', report.title, 'report-title'));

    root.append(
        section('Summary', report.summary ? el('p', report.summary) : el('p', 'No summary.', 'empty')),
        section('Key Points', list(report.keyPoints, 'No key points were found.')),
        section('Decisions', list(report.decisions, 'No decisions were written in this note.')),
        section('Action Items', actionsTable(report.actions)),
        section('People Mentioned', list(report.people, 'No people were named.')),
        section('Dates & Numbers', list(report.datesAndNumbers, 'No dates or numbers were found.')),
    );

    const review = section(
        'Needs Review',
        list(report.needsReview, 'Nothing was flagged as uncertain.'),
    );

    if (reviewCount > 0) review.classList.add('review');

    root.append(review);

    const details = el('details');

    details.append(
        el('summary', 'Transcription'),
        el('pre', report.transcription || 'No transcription available.', 'transcription'),
    );
    root.append(details);

    const banner = $('review-banner');

    banner.hidden = reviewCount === 0;
    banner.textContent =
        reviewCount === 1 ? '1 item needs review' : `${reviewCount} items need review`;
}

function setFile(file) {
    state.file = file;
    $('file-name').textContent = file ? file.name : 'No image selected';
    $('submit').disabled = !file;
    showError('');

    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);

    state.previewUrl = file ? URL.createObjectURL(file) : '';
    $('preview').hidden = !file;

    if (file) $('preview').src = state.previewUrl;
}

// Phone photos are often large. Only when the original exceeds the server
// limit do we re-encode a smaller JPEG, in the browser, before upload.
async function prepareImage(file) {
    if (!state.config || file.size <= state.config.maxImageBytes) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));

    if (!blob) throw new Error('resize');

    return blob;
}

async function extract(event) {
    event.preventDefault();

    if (!state.file) return;

    $('submit').disabled = true;
    $('result').hidden = true;
    showError('');
    setStatus('Reading the note…');

    try {
        const image = await prepareImage(state.file);
        const headers = { 'Content-Type': image.type };

        if (state.config?.mock && $('fixture').value) {
            headers['X-Mock-Fixture'] = $('fixture').value;
        }

        const response = await fetch('/api/extract', { method: 'POST', headers, body: image });
        const body = await response.json();

        if (!response.ok) {
            showError(body?.error?.message || 'Something went wrong. Please try again.');

            return;
        }

        state.csv = body.csv;
        renderReport(body.report, body.reviewCount);
        $('result').hidden = false;
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
        showError('We could not complete the extraction. Please check your connection and try again.');
    } finally {
        setStatus('');
        $('submit').disabled = !state.file;
    }
}

function downloadCsv() {
    // BOM so spreadsheet software reads UTF-8 correctly.
    const blob = new Blob(['﻿', state.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'kalax-extract.csv';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function init() {
    for (const id of ['file-input', 'camera-input']) {
        $(id).addEventListener('change', (event) => setFile(event.target.files[0] ?? null));
    }

    $('extract-form').addEventListener('submit', extract);
    $('download-csv').addEventListener('click', downloadCsv);

    try {
        state.config = await (await fetch('/api/config')).json();
    } catch {
        return;
    }

    if (state.config.ctaUrl) $('cta-link').href = state.config.ctaUrl;

    if (state.config.mock) {
        const select = $('fixture');

        select.append(new Option('Automatic (by image)', ''));
        for (const name of state.config.fixtures) select.append(new Option(name, name));
        $('mock-panel').hidden = false;
    }
}

init();
