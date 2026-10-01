const form = document.querySelector('#crawl-form');
const button = document.querySelector('#start-button');
const statusText = document.querySelector('#status-text');

const progress = document.querySelector('#progress');
const progressToggle =
    document.querySelector('#progress-toggle');
const progressCount =
    document.querySelector('#progress-count');
const progressChevron =
    document.querySelector('#progress-chevron');
const progressList =
    document.querySelector('#progress-list');

const summary = document.querySelector('#summary');

const results = document.querySelector('#results');
const resultsMeta =
    document.querySelector('#results-meta');
const resultsBody =
    document.querySelector('#results-body');

const downloadCsvButton =
    document.querySelector('#download-csv');

const downloadJsonButton =
    document.querySelector('#download-json');

let activeStream = null;
let latestResults = [];

function setStatus(message, state = '') {
    statusText.textContent = message;

    statusText.classList.remove(
        'status-running',
        'status-complete',
        'status-error',
    );

    if (state) {
        statusText.classList.add(`status-${state}`);
    }
}

function setProgressCollapsed(collapsed) {
    progress.classList.toggle(
        'is-collapsed',
        collapsed,
    );

    progressToggle.setAttribute(
        'aria-expanded',
        String(!collapsed),
    );

    progressChevron.textContent =
        collapsed ? '+' : '−';
}

function resetProgress() {
    progress.hidden = false;

    setProgressCollapsed(false);

    progressCount.textContent =
        '0 pages processed';

    progressList.replaceChildren();

    summary.hidden = true;

    results.hidden = true;
    resultsBody.replaceChildren();

    latestResults = [];
}

function addProgressRow(page) {
    const row = document.createElement('div');
    row.className = 'progress-row';

    const mark = document.createElement('span');
    mark.className = 'progress-mark';
    mark.textContent =
        page.status === 'OK' ? '✓' : '×';

    const url = document.createElement('span');
    url.className = 'progress-url';
    url.textContent = page.url;

    row.append(mark, url);
    progressList.append(row);

    progressList.scrollTop =
        progressList.scrollHeight;

    progressCount.textContent =
        `${page.current} ` +
        `${page.current === 1 ? 'page' : 'pages'} processed`;
}

function addUrlCell(row, value) {
    const cell = document.createElement('td');
    cell.className = 'result-url';

    const link = document.createElement('a');
    link.className = 'result-link';
    link.href = value;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = value;
    link.title = value;

    cell.append(link);
    row.append(cell);
}

function addCell(row, className, value) {
    const cell = document.createElement('td');
    cell.className = className;
    cell.textContent = value ?? '';
    cell.title = value ?? '';
    row.append(cell);
}

function renderResults(crawl) {
    latestResults = crawl.results;

    resultsBody.replaceChildren();

    for (const item of latestResults) {
        const row = document.createElement('tr');

        addUrlCell(row, item.url);
        addCell(
            row,
            'result-title',
            item.title,
        );
        addCell(
            row,
            'result-status',
            item.status,
        );

        resultsBody.append(row);
    }

    resultsMeta.textContent =
        `${latestResults.length} ` +
        `${latestResults.length === 1 ? 'page' : 'pages'} · ` +
        `${crawl.hostname}`;

    results.hidden = false;
}

function csvEscape(value) {
    const text = String(value ?? '');

    if (/[",\n\r]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}

function createCsv(rows) {
    const headers = [
        'url',
        'title',
        'status',
    ];

    const lines = [
        headers.join(','),
        ...rows.map((row) =>
            headers
                .map((header) =>
                    csvEscape(row[header])
                )
                .join(',')
        ),
    ];

    return `${lines.join('\n')}\n`;
}

function downloadFile(
    filename,
    contents,
    type,
) {
    const blob = new Blob(
        [contents],
        { type },
    );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function finish() {
    button.disabled = false;
    button.textContent = 'Start crawl';

    if (activeStream) {
        activeStream.close();
        activeStream = null;
    }
}

progressToggle.addEventListener(
    'click',
    () => {
        setProgressCollapsed(
            !progress.classList.contains(
                'is-collapsed',
            ),
        );
    },
);

downloadCsvButton.addEventListener(
    'click',
    () => {
        if (latestResults.length === 0) {
            return;
        }

        downloadFile(
            'kalax-crawl-results.csv',
            createCsv(latestResults),
            'text/csv;charset=utf-8',
        );
    },
);

downloadJsonButton.addEventListener(
    'click',
    () => {
        if (latestResults.length === 0) {
            return;
        }

        downloadFile(
            'kalax-crawl-results.json',
            `${JSON.stringify(
                latestResults,
                null,
                2,
            )}\n`,
            'application/json;charset=utf-8',
        );
    },
);

form.addEventListener(
    'submit',
    (event) => {
        event.preventDefault();

        if (activeStream) {
            activeStream.close();
        }

        const data =
            new FormData(form);

        const url =
            String(data.get('url')).trim();

        const maxPages =
            Number(data.get('maxPages'));

        if (!url) {
            setStatus(
                'Enter a website URL to start crawling.',
                'error',
            );

            return;
        }

        button.disabled = true;
        button.textContent = 'Crawling…';

        setStatus(
            'Crawler running locally…',
            'running',
        );

        resetProgress();

        const params =
            new URLSearchParams({
                url,
                maxPages:
                    String(maxPages),
            });

        activeStream =
            new EventSource(
                `/api/crawl-stream?${params.toString()}`,
            );

        activeStream.addEventListener(
            'page',
            (event) => {
                const page =
                    JSON.parse(event.data);

                addProgressRow(page);
            },
        );

        activeStream.addEventListener(
            'complete',
            (event) => {
                const crawl =
                    JSON.parse(event.data);

                setStatus(
                    'Crawl complete.',
                    'complete',
                );

                summary.textContent =
                    `${crawl.results.length} ` +
                    `${crawl.results.length === 1
                        ? 'page'
                        : 'pages'} processed · ` +
                    `max ${crawl.maxPages}`;

                summary.hidden = false;

                renderResults(crawl);

                setProgressCollapsed(true);

                results.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });

                finish();
            },
        );

        activeStream.addEventListener(
            'crawl-error',
            (event) => {
                const error =
                    JSON.parse(event.data);

                setStatus(
                    error.message ||
                        'Crawl failed.',
                    'error',
                );

                summary.hidden = true;

                setProgressCollapsed(true);

                finish();
            },
        );

        activeStream.onerror = () => {
            if (!activeStream) {
                return;
            }

            setStatus(
                'Connection to crawler was interrupted.',
                'error',
            );

            setProgressCollapsed(true);

            finish();
        };
    },
);
