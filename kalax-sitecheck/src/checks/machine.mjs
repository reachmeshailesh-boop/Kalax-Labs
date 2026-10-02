function flattenJsonLd(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const nodes = [value];

  if (Array.isArray(value['@graph'])) {
    nodes.push(...value['@graph'].flatMap(flattenJsonLd));
  }

  return nodes;
}

export function checkStructuredDataHealth(pages) {
  const parsed = [];
  const invalid = [];
  const nodes = [];

  for (const page of pages) {
    for (const raw of page.jsonLd || []) {
      try {
        const value = JSON.parse(raw);
        const extracted = flattenJsonLd(value);

        parsed.push({
          url: page.url,
          nodeCount: extracted.length,
        });

        for (const node of extracted) {
          nodes.push({
            url: page.url,
            type: node['@type'] ?? null,
            node,
          });
        }
      } catch (error) {
        invalid.push({
          url: page.url,
          error: error.message,
        });
      }
    }
  }

  const hasStructuredData = parsed.length > 0;

  return {
    id: 'machine_structured_data_health',
    category: 'machine',
    status:
      invalid.length > 0
        ? 'NEEDS_ATTENTION'
        : hasStructuredData
          ? 'PASS'
          : 'NOT_VERIFIED',
    finding:
      invalid.length > 0
        ? `${invalid.length} JSON-LD block(s) could not be parsed.`
        : hasStructuredData
          ? `${parsed.length} JSON-LD block(s) were parsed successfully.`
          : 'No JSON-LD structured data was observed on checked pages.',
    evidence: {
      parsed,
      invalid,
      nodes,
    },
    whyItMatters:
      'Structured data gives machines explicit information about pages and the entities they describe.',
    suggestedAction:
      invalid.length > 0
        ? 'Review and repair the affected JSON-LD blocks.'
        : hasStructuredData
          ? 'Keep structured data valid and aligned with visible site content.'
          : 'Consider adding appropriate structured data where it accurately represents visible site content.',
  };
}

const BUSINESS_TYPES = new Set([
  'Organization',
  'Corporation',
  'LocalBusiness',
  'ProfessionalService',
]);

function schemaTypes(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function checkBusinessIdentityMarkup(structuredDataFinding) {
  const businessEntities = structuredDataFinding.evidence.nodes
    .filter(({ node }) =>
      schemaTypes(node?.['@type']).some((type) => BUSINESS_TYPES.has(type)),
    )
    .map(({ url, node }) => ({
      url,
      type: node['@type'],
      name: node.name ?? null,
      id: node['@id'] ?? null,
    }));

  const namedEntities = businessEntities.filter(
    ({ name }) => typeof name === 'string' && name.trim(),
  );

  if (businessEntities.length === 0) {
    return {
      id: 'identity_business_markup',
      category: 'identity',
      status: 'NOT_VERIFIED',
      finding: 'No recognized business identity entity was observed in parsed JSON-LD.',
      evidence: { businessEntities },
      whyItMatters:
        'Explicit business identity markup can help machines connect site content to the organization it represents.',
      suggestedAction:
        'Consider appropriate organization or business structured data that accurately represents the visible business.',
    };
  }

  const needsAttention = namedEntities.length === 0;

  return {
    id: 'identity_business_markup',
    category: 'identity',
    status: needsAttention ? 'NEEDS_ATTENTION' : 'PASS',
    finding: needsAttention
      ? `${businessEntities.length} business entity declaration(s) were found, but no business name was declared.`
      : `${namedEntities.length} named business entity declaration(s) were found.`,
    evidence: { businessEntities },
    whyItMatters:
      'Explicit business identity markup can help machines connect site content to the organization it represents.',
    suggestedAction: needsAttention
      ? 'Add the visible business name to the relevant structured-data entity.'
      : 'Keep business identity markup consistent with the visible business identity.',
  };
}

export function checkIdentityConsistency(businessIdentityFinding) {
  const entities = businessIdentityFinding.evidence.businessEntities || [];

  if (entities.length === 0) {
    return {
      id: 'identity_consistency',
      category: 'identity',
      status: 'NOT_VERIFIED',
      finding: 'Business identity consistency could not be verified because no business entities were observed.',
      evidence: { identities: [] },
      whyItMatters:
        'Consistent business identity declarations help machines associate pages with the same organization.',
      suggestedAction:
        'Establish explicit business identity markup before evaluating consistency.',
    };
  }

  const grouped = new Map();

  for (const entity of entities) {
    const types = schemaTypes(entity.type).sort();
    const name =
      typeof entity.name === 'string'
        ? entity.name.trim()
        : '';

    const key = JSON.stringify([types, name]);

    if (!grouped.has(key)) {
      grouped.set(key, {
        types,
        name: name || null,
        urls: [],
      });
    }

    grouped.get(key).urls.push(entity.url);
  }

  const identities = [...grouped.values()];
  const consistent = identities.length === 1;

  return {
    id: 'identity_consistency',
    category: 'identity',
    status: consistent ? 'PASS' : 'NEEDS_ATTENTION',
    finding: consistent
      ? `A consistent business identity was observed across ${entities.length} declaration(s).`
      : `${identities.length} different business identity declarations were observed.`,
    evidence: { identities },
    whyItMatters:
      'Consistent business identity declarations help machines associate pages with the same organization.',
    suggestedAction: consistent
      ? 'Keep the declared business identity consistent across public pages.'
      : 'Review differing business names or types and confirm which identity each page is intended to represent.',
  };
}

export function checkExternalIdentityReferences(structuredDataFinding, siteHostname) {
  const references = [];
  const invalid = [];

  for (const { url: sourceUrl, node } of structuredDataFinding.evidence.nodes || []) {
    const values = Array.isArray(node?.sameAs)
      ? node.sameAs
      : node?.sameAs
        ? [node.sameAs]
        : [];

    for (const value of values) {
      try {
        const target = new URL(value);

        if (!['http:', 'https:'].includes(target.protocol)) {
          invalid.push({ sourceUrl, value });
          continue;
        }

        if (target.hostname.toLowerCase() === siteHostname.toLowerCase()) {
          continue;
        }

        references.push({
          sourceUrl,
          entityType: node['@type'] ?? null,
          entityName: node.name ?? null,
          targetUrl: target.href,
        });
      } catch {
        invalid.push({ sourceUrl, value });
      }
    }
  }

  const uniqueTargets = [
    ...new Map(references.map((item) => [item.targetUrl, item])).values(),
  ];

  if (invalid.length > 0) {
    return {
      id: 'identity_external_references',
      category: 'identity',
      status: 'NEEDS_ATTENTION',
      finding: `${invalid.length} invalid external identity reference(s) were observed.`,
      evidence: { references, uniqueTargets, invalid },
      whyItMatters:
        'External identity references can help machines connect an entity on the website with its presence elsewhere.',
      suggestedAction:
        'Review malformed identity references and keep only valid URLs representing the same entity.',
    };
  }

  return {
    id: 'identity_external_references',
    category: 'identity',
    status: uniqueTargets.length > 0 ? 'PASS' : 'NOT_VERIFIED',
    finding:
      uniqueTargets.length > 0
        ? `${uniqueTargets.length} unique external identity reference(s) were observed.`
        : 'No external identity references were observed in parsed structured data.',
    evidence: { references, uniqueTargets, invalid },
    whyItMatters:
      'External identity references can help machines connect an entity on the website with its presence elsewhere.',
    suggestedAction:
      uniqueTargets.length > 0
        ? 'Keep external identity references accurate and aligned with the entities they represent.'
        : 'Consider adding accurate external identity references where appropriate.',
  };
}

export function checkContentStructure(pages) {
  const structured = [];
  const withoutHeadings = [];
  const unverified = [];

  for (const page of pages) {
    if (page.crawlError || page.status == null) {
      unverified.push({
        url: page.url,
        reason: page.crawlError || 'Page status unavailable',
      });
      continue;
    }

    if (page.status >= 400) continue;

    const headings = (page.headings || []).filter(
      ({ text }) => typeof text === 'string' && text.trim(),
    );

    if (headings.length === 0) {
      withoutHeadings.push({ url: page.url });
      continue;
    }

    structured.push({
      url: page.url,
      headingCount: headings.length,
      headings,
    });
  }

  let status = 'PASS';

  if (withoutHeadings.length > 0) {
    status = 'NEEDS_ATTENTION';
  } else if (unverified.length > 0 || structured.length === 0) {
    status = 'NOT_VERIFIED';
  }

  return {
    id: 'machine_content_structure',
    category: 'machine',
    status,
    finding:
      withoutHeadings.length > 0
        ? `${withoutHeadings.length} checked reachable page(s) expose no meaningful headings.`
        : unverified.length > 0
          ? `Content structure could not be verified for ${unverified.length} page(s).`
          : 'Checked reachable pages expose meaningful heading structure.',
    evidence: {
      structured,
      withoutHeadings,
      unverified,
    },
    whyItMatters:
      'Meaningful headings provide explicit structure that helps people and machines understand how page content is organized.',
    suggestedAction:
      withoutHeadings.length > 0
        ? 'Add meaningful headings that describe the major sections of the affected pages.'
        : 'Keep headings descriptive and aligned with the visible content they introduce.',
  };
}

export function checkMobileBasics(pages) {
  const configured = [];
  const missing = [];
  const unverified = [];

  for (const page of pages) {
    if (page.crawlError || page.status == null) {
      unverified.push({
        url: page.url,
        reason: page.crawlError || 'Page status unavailable',
      });
      continue;
    }

    if (page.status >= 400) continue;

    const viewport =
      typeof page.viewport === 'string'
        ? page.viewport.trim()
        : '';

    if (!viewport) {
      missing.push({ url: page.url });
      continue;
    }

    configured.push({
      url: page.url,
      viewport,
    });
  }

  let status = 'PASS';

  if (missing.length > 0) {
    status = 'NEEDS_ATTENTION';
  } else if (unverified.length > 0 || configured.length === 0) {
    status = 'NOT_VERIFIED';
  }

  return {
    id: 'machine_mobile_basics',
    category: 'machine',
    status,
    finding:
      missing.length > 0
        ? `${missing.length} checked reachable page(s) lack a viewport declaration.`
        : unverified.length > 0
          ? `Mobile basics could not be verified for ${unverified.length} page(s).`
          : 'Checked reachable pages expose viewport configuration for responsive rendering.',
    evidence: {
      configured,
      missing,
      unverified,
    },
    whyItMatters:
      'Viewport configuration helps browsers render pages appropriately across mobile screen sizes.',
    suggestedAction:
      missing.length > 0
        ? 'Add an appropriate viewport declaration to the affected pages.'
        : 'Keep viewport configuration present as layouts evolve.',
  };
}
