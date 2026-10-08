import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreRun } from '../src/acceptance.mjs';
import { reportToCsv } from '../src/csv.mjs';
import { validateReport } from '../src/schema.mjs';

// SYNTHETIC data to test the scorer's arithmetic only. These are not images,
// not handwriting and not results of any real model.

const truth = (over = {}) => ({
    id: 'T', category: 'A', expect: 'report', transcription: 'Call Amit Friday. Budget 250000.',
    criticalNames: ['Amit'], criticalNumbers: ['250000'], criticalDates: ['Friday'],
    decisions: [], actions: [{ action: 'Call Amit', owner: '', due: 'Friday' }],
    ambiguous: [{ description: 'name unclear', flagMatch: ['name'] }], ...over,
});

const report = (over = {}) =>
    validateReport({
        title: '', summary: '', keyPoints: [], decisions: [], people: ['Amit'], datesAndNumbers: ['250000', 'Friday'],
        actions: [{ action: 'Call Amit', owner: '', due: 'Friday' }],
        needsReview: ['The name near the top is unclear.'], transcription: 'Call Amit Friday', ...over,
    });

const entry = (r, over = {}) => ({ truth: truth(), outcome: 'report', report: r, csv: reportToCsv(r), ...over });

test('no results means PENDING, never PASS', () => {
    assert.equal(scoreRun([]).verdict, 'PENDING');
});

test('a faithful run passes the thresholds it can measure', () => {
    const control = { truth: truth({ expect: 'fail_safe' }), outcome: 'safe_failure' };
    const { verdict, results } = scoreRun([entry(report()), control]);

    assert.equal(verdict, 'PASS');
    assert.ok(Object.values(results).every((v) => v === 'PASS'));
});

test('fabricated names are counted and fail the run', () => {
    const { metrics, verdict } = scoreRun([entry(report({ people: ['Amit', 'Rahul'] }))]);

    assert.equal(metrics.fabricatedCriticalFacts, 1);
    assert.equal(verdict, 'FAIL');
});

test('invented owner or deadline for a note that states none is counted', () => {
    const invented = report({ actions: [{ action: 'Call Amit', owner: 'Priya', due: 'Friday' }] });
    const { metrics } = scoreRun([entry(invented, { truth: truth({ actions: [{ action: 'Call Amit', owner: '', due: '' }] }) })]);

    assert.equal(metrics.inventedMissingInfo, 2);
});

test('unflagged ambiguity, missed facts and CSV mismatch are detected', () => {
    const silent = report({ needsReview: [], people: [], datesAndNumbers: [], actions: [] });
    const bad = scoreRun([entry(silent)]);

    assert.equal(bad.metrics.ambiguousFlagged, 0);
    assert.ok(bad.metrics.criticalFacts < 0.95);
    assert.equal(bad.metrics.explicitActions, 0);

    const tampered = scoreRun([entry(report(), { csv: 'tampered' })]);

    assert.equal(tampered.metrics.csvMatches, 0);
    assert.equal(tampered.results.csvMatches, 'FAIL');
});

test('a negative control that produces a report fails the safe-failure CTQ', () => {
    const { metrics } = scoreRun([{ truth: truth({ expect: 'fail_safe' }), outcome: 'report', report: report(), csv: '' }]);

    assert.equal(metrics.badImageFailsSafely, 0);
});

test('unmeasured CTQs make the verdict INCOMPLETE rather than PASS', () => {
    assert.equal(scoreRun([entry(report())]).verdict, 'INCOMPLETE');
});
