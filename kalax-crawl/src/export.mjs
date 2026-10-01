import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function csvEscape(value) {
    const text = String(value ?? '');

    if (/[",\n\r]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}

export async function exportResults(results, outputDir = 'output') {
    await mkdir(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, 'crawl-results.json');
    const csvPath = path.join(outputDir, 'crawl-results.csv');

    const json = `${JSON.stringify(results, null, 2)}\n`;

    const headers = ['url', 'title', 'status'];

    const csvRows = [
        headers.join(','),
        ...results.map((result) =>
            headers.map((header) => csvEscape(result[header])).join(',')
        ),
    ];

    const csv = `${csvRows.join('\n')}\n`;

    await Promise.all([
        writeFile(jsonPath, json, 'utf8'),
        writeFile(csvPath, csv, 'utf8'),
    ]);

    return {
        jsonPath,
        csvPath,
    };
}
