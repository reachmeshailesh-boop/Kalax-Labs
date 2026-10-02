import { PDFDocument } from 'pdfkit';

const GROUPS = [
  {
    number: '01',
    name: 'Customer Reachability',
    ids: ['customer_contact_routes', 'customer_enquiry_path'],
  },
  {
    number: '02',
    name: 'Search & Crawl',
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
    ids: [
      'identity_business_markup',
      'identity_consistency',
      'identity_external_references',
    ],
  },
  {
    number: '04',
    name: 'Machine Readability',
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
      return `${missingTitle} ${plural(missingTitle, 'page')} missing a title; ${missingDescription} missing a description.`;
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

      return `${missing} missing; ${invalid} invalid; ${review} ${plural(review, 'canonical')} needing review.`;
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
        const identity = names.length === 1 ? `"${names[0]}"` : 'the business';
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
        return `The same business identity, "${identity.name}", was found across ${pages} checked ${plural(pages, 'page')}.`;
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

      return `${without} ${plural(without, 'page')} without detected headings; ${unknown} not verified.`;
    }

    case 'machine_mobile_basics': {
      const configured = count(e.configured);
      const missing = count(e.missing);
      const unknown = count(e.unverified);

      if (finding.status === 'PASS') {
        return `All ${configured} checked ${plural(configured, 'page')} include a mobile viewport configuration.`;
      }

      return `${missing} ${plural(missing, 'page')} missing a mobile viewport configuration; ${unknown} not verified.`;
    }
  }

  if (finding.status === 'NOT_VERIFIED') {
    return 'SiteCheck could not establish this reliably from the pages checked.';
  }

  if (finding.status === 'PASS') {
    return 'SiteCheck found sufficient positive evidence for this check.';
  }

  return 'SiteCheck found something worth reviewing.';
}

function ensureSpace(doc, height = 70) {
  if (doc.y + height > doc.page.height - 64) {
    doc.addPage();
  }
}

function divider(doc) {
  doc
    .moveTo(54, doc.y)
    .lineTo(doc.page.width - 54, doc.y)
    .lineWidth(0.5)
    .strokeColor('#D8D4CA')
    .stroke();

  doc.moveDown(0.8);
}

function addFinding(doc, finding) {
  ensureSpace(doc, 85);

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(finding.status === 'PASS' ? '#456A52' : '#7A5D26')
    .text(finding.status.replace('_', ' '));

  doc
    .moveDown(0.25)
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#181713')
    .text(LABELS[finding.id] || finding.id);

  doc
    .moveDown(0.25)
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#55524A')
    .text(findingMessage(finding), {
      lineGap: 2,
    });

  doc.moveDown(0.8);
}

export function createSiteCheckPdf(result) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 54,
      right: 54,
      bottom: 58,
      left: 54,
    },
    info: {
      Title: `SiteCheck — ${result.requestedUrl}`,
      Author: 'Kalax Labs',
      Subject: 'Website clarity report',
    },
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#8A6A2F')
    .text('KALAX LABS / 002');

  doc
    .moveDown(1.4)
    .font('Helvetica-Bold')
    .fontSize(27)
    .fillColor('#181713')
    .text('SiteCheck');

  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor('#55524A')
    .text('Website clarity report');

  doc.moveDown(1.5);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#181713')
    .text('WEBSITE');

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#55524A')
    .text(result.requestedUrl);

  doc.moveDown(0.8);

  const checkedAt = result.startedAt
    ? new Date(result.startedAt).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      })
    : 'Not recorded';

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#77736A')
    .text(`${result.pagesChecked} pages checked · Check started ${checkedAt} UTC`);

  doc.moveDown(1.4);
  divider(doc);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#8A6A2F')
    .text('EXECUTIVE SNAPSHOT');

  doc.moveDown(0.8);

  const counts = result.counts || {};
  const snapshot = [
    ['Passed', counts.PASS ?? 0],
    ['Need attention', counts.NEEDS_ATTENTION ?? 0],
    ['Failed', counts.FAIL ?? 0],
    ['Not verified', counts.NOT_VERIFIED ?? 0],
  ];

  const snapshotTop = doc.y;
  const snapshotWidth = doc.page.width - 108;
  const columnWidth = snapshotWidth / snapshot.length;

  snapshot.forEach(([label, value], index) => {
    const x = 54 + (index * columnWidth);

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#181713')
      .text(String(value), x, snapshotTop, {
        width: columnWidth - 12,
        height: 24,
        lineBreak: false,
      });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#77736A')
      .text(label, x, snapshotTop + 27, {
        width: columnWidth - 12,
        height: 12,
        lineBreak: false,
      });

    doc.x = 54;
    doc.y = snapshotTop;
  });

  doc.x = 54;
  doc.y = snapshotTop + 52;
  divider(doc);

  for (const group of GROUPS) {
    ensureSpace(doc, 100);

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#8A6A2F')
      .text(group.number);

    doc
      .moveDown(0.2)
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#181713')
      .text(group.name);

    doc.moveDown(0.7);

    const findings = group.ids
      .map((id) => result.findings.find((finding) => finding.id === id))
      .filter(Boolean);

    for (const finding of findings) {
      addFinding(doc, finding);
    }

    doc.moveDown(0.5);
    divider(doc);
  }

  const actions = result.findings.filter(
    (finding) =>
      finding.status === 'FAIL' ||
      finding.status === 'NEEDS_ATTENTION',
  );

  ensureSpace(doc, 100);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#8A6A2F')
    .text('PRIORITY ACTIONS');

  doc.moveDown(0.6);

  if (actions.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#55524A')
      .text(
        'No priority actions were generated because SiteCheck found no failed or needs-attention findings in the areas it could verify.',
        { lineGap: 2 },
      );
  } else {
    for (const finding of actions) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#181713')
        .text(LABELS[finding.id] || finding.id);

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#55524A')
        .text(findingMessage(finding), { lineGap: 2 });

      doc.moveDown(0.6);
    }
  }

  doc.moveDown(1.2);
  divider(doc);

  ensureSpace(doc, 145);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#8A6A2F')
    .text('METHODOLOGY & LIMITATIONS');

  doc.moveDown(0.6);

  doc
    .font('Helvetica')
    .fontSize(8.7)
    .fillColor('#666259')
    .text(
      'SiteCheck performs a bounded local crawl of the submitted website and applies deterministic checks to the pages examined. PASS means sufficient positive evidence was found for that specific check. NEEDS ATTENTION means concrete evidence was found that merits review. FAIL is reserved for objectively testable failures. NOT VERIFIED means SiteCheck could not establish the condition reliably.',
      { lineGap: 2 },
    );

  doc.moveDown(0.7);

  doc.text(
    'This report is not a complete SEO, GEO, accessibility, mobile-friendliness, security, legal or compliance certification. Findings describe only the evidence SiteCheck could establish from the pages checked during this run.',
    { lineGap: 2 },
  );

  return doc;
}
