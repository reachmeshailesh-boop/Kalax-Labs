const GROUPS = [
  {
    number: '01',
    name: 'Customer Reachability',
    description: 'Can people find a clear way to contact or enquire with you?',
    ids: ['customer_contact_routes', 'customer_enquiry_path'],
  },
  {
    number: '02',
    name: 'Search & Crawl',
    description: 'Can search systems reach, identify and navigate the pages we checked?',
    ids: [
      'search_page_reachability',
      'search_broken_internal_paths',
      'search_page_identification',
      'search_canonical_setup',
    ],
  },
  {
    number: '03',
    name: 'Business Identity',
    description: 'Does the site expose a consistent machine-readable identity for the business?',
    ids: [
      'identity_business_markup',
      'identity_consistency',
      'identity_external_references',
    ],
  },
  {
    number: '04',
    name: 'Machine Readability',
    description: 'Can machines parse the site structure and supporting information?',
    ids: [
      'machine_structured_data_health',
      'machine_content_structure',
      'machine_mobile_basics',
    ],
  },
];

const LABELS = {
  customer_contact_routes: 'Contact routes',
  customer_enquiry_path: 'Enquiry path',
  search_page_reachability: 'Page reachability',
  search_broken_internal_paths: 'Working internal paths',
  search_page_identification: 'Page identification',
  search_canonical_setup: 'Preferred page URLs',
  identity_business_markup: 'Business identity markup',
  identity_consistency: 'Identity consistency',
  identity_external_references: 'External identity references',
  machine_structured_data_health: 'Structured information',
  machine_content_structure: 'Content structure',
  machine_mobile_basics: 'Mobile setup',
};

const STATUS_LABELS = {
  PASS: 'PASS',
  NEEDS_ATTENTION: 'NEEDS ATTENTION',
  FAIL: 'FAIL',
  NOT_VERIFIED: 'NOT VERIFIED',
};

function statusClass(status) {
  if (status === 'PASS') return 'pass';
  if (status === 'NOT_VERIFIED') return 'unknown';
  if (status === 'FAIL') return 'fail';
  return 'attention';
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function plural(number, singular, pluralForm = `${singular}s`) {
  return number === 1 ? singular : pluralForm;
}

function findingMessage(finding) {
  const e = finding.evidence || {};

  switch (finding.id) {
    case 'customer_contact_routes': {
      const routes = [];
      if (count(e.phone)) routes.push('phone');
      if (count(e.email)) routes.push('email');
      if (count(e.whatsapp)) routes.push('WhatsApp');
      if (count(e.enquiry)) routes.push('enquiry');

      if (finding.status === 'PASS' && routes.length) {
        return `SiteCheck found ${routes.join(', ')} ${plural(routes.length, 'route')} across the pages checked.`;
      }
      break;
    }

    case 'customer_enquiry_path': {
      const links = count(e.links);
      const forms = count(e.forms);

      if (finding.status === 'PASS') {
        const parts = [];
        if (links) parts.push(`${links} enquiry ${plural(links, 'link')}`);
        if (forms) parts.push(`${forms} ${plural(forms, 'form')}`);

        return parts.length
          ? `Visitors have an enquiry path. SiteCheck found ${parts.join(' and ')}.`
          : 'SiteCheck found evidence of an enquiry path.';
      }
      break;
    }

    case 'search_page_reachability': {
      const healthy = count(e.healthy);
      const errors = count(e.httpErrors);
      const unknown = count(e.notVerified);

      if (finding.status === 'PASS') {
        return `All ${healthy} checked ${plural(healthy, 'page')} loaded successfully.`;
      }

      if (errors) {
        return `${errors} checked ${plural(errors, 'page')} returned an HTTP error.`;
      }

      if (unknown) {
        return `${unknown} ${plural(unknown, 'page')} could not be verified reliably.`;
      }
      break;
    }

    case 'search_broken_internal_paths': {
      const checked = count(e.checkedInternalLinks);
      const broken = count(e.broken);

      if (finding.status === 'PASS') {
        return `No broken destinations were found among ${checked} checked internal link ${plural(checked, 'observation')}.`;
      }

      if (broken) {
        return `${broken} broken internal ${plural(broken, 'destination')} ${broken === 1 ? 'was' : 'were'} found among the destinations SiteCheck could verify.`;
      }
      break;
    }

    case 'search_page_identification': {
      const identified = count(e.identified);
      const missingTitle = count(e.missingTitle);
      const missingDescription = count(e.missingDescription);

      if (finding.status === 'PASS') {
        return `All ${identified} checked ${plural(identified, 'page')} have both a page title and description.`;
      }

      return `${missingTitle} ${plural(missingTitle, 'page')} missing a title · ${missingDescription} missing a description.`;
    }

    case 'search_canonical_setup': {
      const self = count(e.validSelf);
      const consolidated = count(e.consolidatedVariants);
      const missing = count(e.missing);
      const invalid = count(e.invalid);
      const review = count(e.review);

      if (finding.status === 'PASS') {
        const variantText = consolidated
          ? ` ${consolidated} ${plural(consolidated, 'URL variant')} ${consolidated === 1 ? 'is' : 'are'} consolidated to a preferred URL.`
          : '';

        return `Preferred page URLs are configured across the checked pages. ${self} ${plural(self, 'page')} ${self === 1 ? 'is' : 'are'} self-referencing.${variantText}`;
      }

      return `${missing} missing · ${invalid} invalid · ${review} ${plural(review, 'canonical')} needing review.`;
    }

    case 'machine_structured_data_health': {
      const parsed = count(e.parsed);
      const invalid = count(e.invalid);

      if (finding.status === 'PASS') {
        return `SiteCheck parsed ${parsed} structured-data ${plural(parsed, 'block')} with no invalid blocks detected.`;
      }

      if (invalid) {
        return `${invalid} structured-data ${plural(invalid, 'block')} could not be parsed correctly.`;
      }
      break;
    }

    case 'identity_business_markup': {
      const entities = e.businessEntities || [];

      if (finding.status === 'PASS' && entities.length) {
        const names = [...new Set(entities.map((item) => item.name).filter(Boolean))];
        const types = [...new Set(entities.map((item) => item.type).filter(Boolean))];

        const identity = names.length === 1 ? `“${names[0]}”` : 'the business';
        const type = types.length === 1 ? ` as ${types[0]}` : '';

        return `Machine-readable markup identifies ${identity}${type} across ${entities.length} checked ${plural(entities.length, 'page')}.`;
      }
      break;
    }

    case 'identity_consistency': {
      const identities = e.identities || [];

      if (finding.status === 'PASS' && identities.length === 1) {
        const identity = identities[0];
        const pages = count(identity.urls);
        return `The same business identity, “${identity.name}”, was found across ${pages} checked ${plural(pages, 'page')}.`;
      }

      if (identities.length > 1) {
        return `${identities.length} different machine-readable business identities were found and should be reviewed.`;
      }
      break;
    }

    case 'identity_external_references': {
      const targets = e.uniqueTargets || [];
      const invalid = count(e.invalid);

      if (finding.status === 'PASS' && targets.length) {
        const hosts = [...new Set(targets.map((item) => {
          try {
            return new URL(item.targetUrl).hostname.replace(/^www\./, '');
          } catch {
            return item.targetUrl;
          }
        }))];

        return `Machine-readable identity references connect the site to ${targets.length} external ${plural(targets.length, 'profile')}: ${hosts.join(', ')}.`;
      }

      if (invalid) {
        return `${invalid} external identity ${plural(invalid, 'reference')} could not be validated.`;
      }
      break;
    }

    case 'machine_content_structure': {
      const structured = count(e.structured);
      const without = count(e.withoutHeadings);
      const unknown = count(e.unverified);

      if (finding.status === 'PASS') {
        return `All ${structured} checked ${plural(structured, 'page')} use headings to organise their content.`;
      }

      return `${without} ${plural(without, 'page')} without detected headings · ${unknown} not verified.`;
    }

    case 'machine_mobile_basics': {
      const configured = count(e.configured);
      const missing = count(e.missing);
      const unknown = count(e.unverified);

      if (finding.status === 'PASS') {
        return `All ${configured} checked ${plural(configured, 'page')} include a mobile viewport configuration.`;
      }

      return `${missing} ${plural(missing, 'page')} missing a mobile viewport configuration · ${unknown} not verified.`;
    }
  }

  if (typeof finding.summary === 'string' && finding.summary.trim()) {
    return finding.summary;
  }

  if (typeof finding.message === 'string' && finding.message.trim()) {
    return finding.message;
  }

  if (finding.status === 'NOT_VERIFIED') {
    return 'SiteCheck could not establish this reliably from the pages checked.';
  }

  if (finding.status === 'PASS') {
    return 'SiteCheck found sufficient positive evidence for this check.';
  }

  return 'SiteCheck found something worth reviewing.';
}

function evidenceText(finding) {
  if (finding.evidence === undefined) return 'No additional evidence.';
  return JSON.stringify(finding.evidence, null, 2);
}

export function renderResults(result) {
  const results = document.querySelector('#results');
  const title = document.querySelector('#results-title');
  const summary = document.querySelector('#results-summary');
  const counts = document.querySelector('#result-counts');
  const groups = document.querySelector('#result-groups');

  const c = result.counts;

  if (c.FAIL === 0 && c.NEEDS_ATTENTION === 0) {
    title.textContent =
      'No issues were found in the areas SiteCheck could verify.';
  } else {
    title.textContent =
      'SiteCheck found areas worth reviewing.';
  }

  summary.textContent =
    `${result.pagesChecked} pages checked · ${result.findings.length} evidence-backed checks.`;

  counts.innerHTML = [
    ['PASS', 'Passed'],
    ['NEEDS_ATTENTION', 'Need attention'],
    ['FAIL', 'Failed'],
    ['NOT_VERIFIED', 'Not verified'],
  ].map(([key, label]) => `
    <div class="result-count">
      <strong>${c[key] ?? 0}</strong>
      <span>${label}</span>
    </div>
  `).join('');

  groups.innerHTML = GROUPS.map((group) => {
    const findings = group.ids
      .map((id) => result.findings.find((finding) => finding.id === id))
      .filter(Boolean);

    return `
      <section class="result-group">
        <div class="result-group-header">
          <div class="result-group-number">${group.number}</div>
          <div>
            <h3>${group.name}</h3>
            <p class="result-group-description">${group.description}</p>
          </div>
        </div>

        ${findings.map((finding) => `
          <article class="finding">
            <div class="finding-status ${statusClass(finding.status)}">
              ${STATUS_LABELS[finding.status] ?? finding.status}
            </div>

            <div>
              <h4>${LABELS[finding.id] ?? finding.id}</h4>
              <p>${escapeHtml(findingMessage(finding))}</p>

              <details>
                <summary>View evidence</summary>
                <pre>${escapeHtml(evidenceText(finding))}</pre>
              </details>
            </div>
          </article>
        `).join('')}
      </section>
    `;
  }).join('');

  results.hidden = false;
  results.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function downloadJsonReport(result) {
  const blob = new Blob(
    [JSON.stringify(result, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );

  const hostname = (() => {
    try {
      return new URL(result.requestedUrl).hostname;
    } catch {
      return 'website';
    }
  })();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `sitecheck-${hostname}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}


export async function downloadPdfReport(result) {
  const response = await fetch('/api/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    let message = 'Could not generate PDF report';

    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep bounded fallback message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  const hostname = (() => {
    try {
      return new URL(result.requestedUrl).hostname;
    } catch {
      return 'website';
    }
  })();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `sitecheck-${hostname}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
