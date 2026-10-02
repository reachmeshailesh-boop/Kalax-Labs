import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkContactRoutes,
  checkEnquiryPath,
} from '../src/checks/customer.mjs';

import {
  checkPageReachability,
  checkBrokenInternalPaths,
  checkPageIdentification,
  checkCanonicalSetup,
} from '../src/checks/search.mjs';

import {
  checkStructuredDataHealth,
  checkBusinessIdentityMarkup,
  checkIdentityConsistency,
  checkExternalIdentityReferences,
  checkContentStructure,
  checkMobileBasics,
} from '../src/checks/machine.mjs';

const healthyPage = (overrides = {}) => ({
  url: 'https://example.test/',
  status: 200,
  title: 'Example Business',
  description: 'Example description',
  canonical: 'https://example.test/',
  viewport: 'width=device-width, initial-scale=1',
  headings: [{ level: 'h1', text: 'Example Business' }],
  links: [],
  forms: [],
  jsonLd: [],
  ...overrides,
});

test('customer: no contact route needs attention', () => {
  const finding = checkContactRoutes([healthyPage()]);
  assert.equal(finding.status, 'NEEDS_ATTENTION');
});

test('customer: email contact route passes', () => {
  const page = healthyPage({
    links: [{
      href: 'mailto:hello@example.test',
      text: 'Email us',
    }],
  });

  const finding = checkContactRoutes([page]);
  assert.equal(finding.status, 'PASS');
  assert.equal(finding.evidence.email.length, 1);
});

test('customer: no enquiry path or form needs attention', () => {
  const pages = [healthyPage()];
  const contact = checkContactRoutes(pages);
  const finding = checkEnquiryPath(pages, contact);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
});

test('customer: enquiry form passes', () => {
  const pages = [
    healthyPage({
      forms: [{ action: '/contact', method: 'post' }],
    }),
  ];

  const contact = checkContactRoutes(pages);
  const finding = checkEnquiryPath(pages, contact);

  assert.equal(finding.status, 'PASS');
  assert.equal(finding.evidence.forms.length, 1);
});

test('search: HTTP error is FAIL', () => {
  const finding = checkPageReachability([
    healthyPage({ status: 404 }),
  ]);

  assert.equal(finding.status, 'FAIL');
  assert.equal(finding.evidence.httpErrors.length, 1);
});

test('search: unavailable status is NOT_VERIFIED', () => {
  const finding = checkPageReachability([
    healthyPage({
      status: null,
      crawlError: 'Connection failed',
    }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
  assert.equal(finding.evidence.notVerified.length, 1);
});

test('search: checked broken internal destination is FAIL', () => {
  const source = healthyPage({
    url: 'https://example.test/',
    links: [{
      href: 'https://example.test/missing',
      text: 'Missing page',
    }],
  });

  const target = healthyPage({
    url: 'https://example.test/missing',
    status: 404,
  });

  const finding = checkBrokenInternalPaths(
    [source, target],
    'example.test',
  );

  assert.equal(finding.status, 'FAIL');
  assert.equal(finding.evidence.broken.length, 1);
});

test('search: unchecked internal destination is not called broken', () => {
  const source = healthyPage({
    links: [{
      href: 'https://example.test/not-checked',
      text: 'Not checked',
    }],
  });

  const finding = checkBrokenInternalPaths(
    [source],
    'example.test',
  );

  assert.equal(finding.status, 'PASS');
  assert.equal(finding.evidence.broken.length, 0);
  assert.equal(finding.evidence.checkedInternalLinks.length, 0);
});

test('search: missing title and description need attention', () => {
  const finding = checkPageIdentification([
    healthyPage({
      title: '',
      description: '',
    }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.missingTitle.length, 1);
  assert.equal(finding.evidence.missingDescription.length, 1);
});

test('search: missing canonical needs attention', () => {
  const finding = checkCanonicalSetup([
    healthyPage({ canonical: '' }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.missing.length, 1);
});

test('search: invalid canonical needs attention', () => {
  const finding = checkCanonicalSetup([
    healthyPage({ canonical: 'not a url' }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.invalid.length, 1);
});

test('search: materially different canonical needs review', () => {
  const finding = checkCanonicalSetup([
    healthyPage({
      canonical: 'https://other.test/different',
    }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.review.length, 1);
});

test('search: query variant canonical consolidation passes', () => {
  const finding = checkCanonicalSetup([
    healthyPage({
      url: 'https://example.test/contact?src=campaign',
      canonical: 'https://example.test/contact',
    }),
  ]);

  assert.equal(finding.status, 'PASS');
  assert.equal(
    finding.evidence.consolidatedVariants.length,
    1,
  );
});

test('machine: no JSON-LD is NOT_VERIFIED', () => {
  const finding = checkStructuredDataHealth([
    healthyPage({ jsonLd: [] }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('machine: malformed JSON-LD needs attention', () => {
  const finding = checkStructuredDataHealth([
    healthyPage({
      jsonLd: ['{"@type":"Organization",'],
    }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.invalid.length, 1);
});

test('machine: valid JSON-LD passes', () => {
  const finding = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Example Ltd',
        }),
      ],
    }),
  ]);

  assert.equal(finding.status, 'PASS');
  assert.equal(finding.evidence.parsed.length, 1);
});

test('identity: no recognized business entity is NOT_VERIFIED', () => {
  const structured = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@type': 'Person',
          name: 'Example Person',
        }),
      ],
    }),
  ]);

  const finding = checkBusinessIdentityMarkup(structured);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('identity: unnamed business entity needs attention', () => {
  const structured = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@type': 'Organization',
        }),
      ],
    }),
  ]);

  const finding = checkBusinessIdentityMarkup(structured);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
});

test('identity: named business entity passes', () => {
  const structured = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@type': 'Organization',
          name: 'Example Ltd',
        }),
      ],
    }),
  ]);

  const finding = checkBusinessIdentityMarkup(structured);

  assert.equal(finding.status, 'PASS');
});

test('identity: contradictory business declarations need attention', () => {
  const businessFinding = {
    evidence: {
      businessEntities: [
        {
          url: 'https://example.test/',
          type: 'Organization',
          name: 'Example Ltd',
          id: null,
        },
        {
          url: 'https://example.test/about',
          type: 'Organization',
          name: 'Different Ltd',
          id: null,
        },
      ],
    },
  };

  const finding = checkIdentityConsistency(businessFinding);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.identities.length, 2);
});

test('identity: no external identity references is NOT_VERIFIED', () => {
  const structured = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@type': 'Organization',
          name: 'Example Ltd',
        }),
      ],
    }),
  ]);

  const finding = checkExternalIdentityReferences(
    structured,
    'example.test',
  );

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('identity: malformed external reference needs attention', () => {
  const structured = checkStructuredDataHealth([
    healthyPage({
      jsonLd: [
        JSON.stringify({
          '@type': 'Organization',
          name: 'Example Ltd',
          sameAs: ['not-a-url'],
        }),
      ],
    }),
  ]);

  const finding = checkExternalIdentityReferences(
    structured,
    'example.test',
  );

  assert.equal(finding.status, 'NEEDS_ATTENTION');
  assert.equal(finding.evidence.invalid.length, 1);
});

test('machine: reachable page without headings needs attention', () => {
  const finding = checkContentStructure([
    healthyPage({ headings: [] }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
});

test('machine: unknown page structure is NOT_VERIFIED', () => {
  const finding = checkContentStructure([
    healthyPage({
      status: null,
      crawlError: 'Navigation failed',
    }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('machine: reachable page without viewport needs attention', () => {
  const finding = checkMobileBasics([
    healthyPage({ viewport: '' }),
  ]);

  assert.equal(finding.status, 'NEEDS_ATTENTION');
});

test('machine: unknown viewport state is NOT_VERIFIED', () => {
  const finding = checkMobileBasics([
    healthyPage({
      status: null,
      crawlError: 'Navigation failed',
    }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('search: broken-path check is NOT_VERIFIED with no reachable page evidence', () => {
  const finding = checkBrokenInternalPaths(
    [healthyPage({ status: 404 })],
    'example.test',
  );

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('search: page identification is NOT_VERIFIED with no reachable page evidence', () => {
  const finding = checkPageIdentification([
    healthyPage({ status: 404 }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('search: canonical setup is NOT_VERIFIED with no reachable page evidence', () => {
  const finding = checkCanonicalSetup([
    healthyPage({ status: 404 }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('machine: content structure is NOT_VERIFIED with only HTTP-error pages', () => {
  const finding = checkContentStructure([
    healthyPage({ status: 404 }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});

test('machine: mobile basics is NOT_VERIFIED with only HTTP-error pages', () => {
  const finding = checkMobileBasics([
    healthyPage({ status: 404 }),
  ]);

  assert.equal(finding.status, 'NOT_VERIFIED');
});
