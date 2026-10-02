import {
  renderResults,
  downloadJsonReport,
  downloadPdfReport,
} from './results.js';

const form = document.querySelector('#sitecheck-form');
const input = document.querySelector('#website');
const button = form.querySelector('button');
const analysis = document.querySelector('#analysis');
const analysisKicker = analysis.querySelector('.eyebrow');
const title = document.querySelector('#analysis-title');
const status = document.querySelector('#analysis-status');
const time = document.querySelector('#analysis-time');
const progress = document.querySelector('#progress-bar');

const stages = [
  [0, 'Opening the site and discovering pages…', 8],
  [3, 'Checking how customers can reach you…', 28],
  [6, 'Checking pages and search signals…', 48],
  [9, 'Reading business identity and structured information…', 68],
  [12, 'Organising the evidence…', 84],
];

const downloadPdf = document.querySelector('#download-pdf');
const downloadJson = document.querySelector('#download-json');

downloadJson.addEventListener('click', () => {
  if (!window.siteCheckResult) return;
  downloadJsonReport(window.siteCheckResult);
});

downloadPdf.addEventListener('click', async () => {
  if (!window.siteCheckResult) return;

  const originalText = downloadPdf.textContent;

  try {
    downloadPdf.disabled = true;
    downloadPdf.textContent = 'Preparing PDF…';
    await downloadPdfReport(window.siteCheckResult);
  } catch (error) {
    window.alert(error.message);
  } finally {
    downloadPdf.disabled = false;
    downloadPdf.textContent = originalText;
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  analysis.hidden = false;
  button.disabled = true;
  input.disabled = true;

  title.textContent = 'Checking your website…';
  status.textContent = stages[0][1];
  progress.style.width = `${stages[0][2]}%`;

  const started = Date.now();

  const timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    time.textContent = `${seconds}s`;

    const stage = [...stages]
      .reverse()
      .find(([at]) => seconds >= at);

    if (stage) {
      status.textContent = stage[1];
      progress.style.width = `${stage[2]}%`;
    }
  }, 500);

  try {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: input.value,
        maxPages: 20,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'SiteCheck could not complete.');
    }

    clearInterval(timer);
    time.textContent =
      `${Math.max(1, Math.round(result.runtimeMs / 1000))}s`;
    progress.style.width = '100%';
    analysisKicker.textContent = 'SITECHECK COMPLETE';
    title.textContent = 'Check complete';
    status.textContent =
      `${result.pagesChecked} pages checked · ${result.findings.length} evidence-backed checks`;

    window.siteCheckResult = result;
    renderResults(result);
  } catch (error) {
    clearInterval(timer);
    progress.style.width = '100%';
    title.textContent = 'We could not complete this check';
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    input.disabled = false;
  }
});
