export function checkPageReachability(pages) {
  const healthy = [];
  const httpErrors = [];
  const notVerified = [];

  for (const page of pages) {
    if (page.crawlError || page.status == null) {
      notVerified.push({
        url: page.url,
        error: page.crawlError || 'No HTTP status was captured.',
      });
      continue;
    }

    if (page.status >= 400) {
      httpErrors.push({
        url: page.url,
        status: page.status,
      });
      continue;
    }

    healthy.push({
      url: page.url,
      status: page.status,
    });
  }

  let status = 'PASS';

  if (httpErrors.length > 0) status = 'FAIL';
  else if (notVerified.length > 0) status = 'NOT_VERIFIED';

  return {
    id: 'search_page_reachability',
    category: 'search',
    status,
    finding:
      status === 'PASS'
        ? `${healthy.length} checked pages were reachable without HTTP errors.`
        : status === 'FAIL'
          ? `${httpErrors.length} checked page(s) returned HTTP errors.`
          : `${notVerified.length} page(s) could not be verified.`,
    evidence: {
      healthy,
      httpErrors,
      notVerified,
    },
    whyItMatters:
      'Customers and search systems need to be able to retrieve important website pages.',
    suggestedAction:
      status === 'PASS'
        ? 'Keep important public pages reachable.'
        : 'Review the affected URLs and resolve retrieval or HTTP errors.',
  };
}

export function checkBrokenInternalPaths(pages, siteHostname) {
  const checked = new Map(
    pages.map((page) => [page.url, page]),
  );

  const broken = [];
  const observed = [];

  for (const source of pages) {
    for (const link of source.links || []) {
      let destination;

      try {
        destination = new URL(link.href);
      } catch {
        continue;
      }

      if (destination.hostname.toLowerCase() !== siteHostname.toLowerCase()) {
        continue;
      }

      destination.hash = '';
      const targetUrl = destination.href;
      const target = checked.get(targetUrl);

      if (!target) continue;

      observed.push({
        sourceUrl: source.url,
        targetUrl,
        status: target.status,
      });

      if (target.status >= 400) {
        broken.push({
          sourceUrl: source.url,
          targetUrl,
          status: target.status,
        });
      }
    }
  }

  const eligiblePages = pages.filter(
    (page) =>
      !page.crawlError &&
      page.status != null &&
      page.status < 400,
  );

  return {
    id: 'search_broken_internal_paths',
    category: 'search',
    status:
      broken.length > 0
        ? 'FAIL'
        : eligiblePages.length > 0
          ? 'PASS'
          : 'NOT_VERIFIED',
    finding:
      broken.length > 0
        ? `${broken.length} broken internal path observation(s) were found.`
        : 'No broken paths were found among checked internal destinations.',
    evidence: {
      checkedInternalLinks: observed,
      broken,
    },
    whyItMatters:
      'Broken internal destinations interrupt customer journeys and prevent reliable crawling.',
    suggestedAction:
      broken.length > 0
        ? 'Repair or redirect the affected internal destinations.'
        : 'Keep important internal destinations working as the site changes.',
  };
}

export function checkPageIdentification(pages) {
  const missingTitle = [];
  const missingDescription = [];
  const identified = [];

  for (const page of pages) {
    if (page.crawlError || page.status == null || page.status >= 400) continue;

    if (!page.title) {
      missingTitle.push({ url: page.url });
    }

    if (!page.description) {
      missingDescription.push({ url: page.url });
    }

    if (page.title && page.description) {
      identified.push({
        url: page.url,
        title: page.title,
        description: page.description,
      });
    }
  }

  const needsAttention =
    missingTitle.length > 0 || missingDescription.length > 0;

  const eligibleCount =
    identified.length +
    missingTitle.length +
    missingDescription.length;

  return {
    id: 'search_page_identification',
    category: 'search',
    status:
      needsAttention
        ? 'NEEDS_ATTENTION'
        : eligibleCount > 0
          ? 'PASS'
          : 'NOT_VERIFIED',
    finding: needsAttention
      ? `${missingTitle.length} page(s) lack a title and ${missingDescription.length} page(s) lack a description.`
      : 'All checked reachable pages expose a title and description.',
    evidence: {
      identified,
      missingTitle,
      missingDescription,
    },
    whyItMatters:
      'Clear page titles and descriptions help people and search systems understand what individual pages are about.',
    suggestedAction: needsAttention
      ? 'Add clear, page-specific titles and descriptions where they are missing.'
      : 'Keep titles and descriptions specific to each page as the site evolves.',
  };
}

function normalizeCanonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return null;
  }
}

export function checkCanonicalSetup(pages) {
  const validSelf = [];
  const consolidatedVariants = [];
  const missing = [];
  const invalid = [];
  const review = [];

  for (const page of pages) {
    if (page.crawlError || page.status == null || page.status >= 400) continue;

    if (!page.canonical) {
      missing.push({ url: page.url });
      continue;
    }

    const canonical = normalizeCanonicalUrl(page.canonical);
    const pageUrl = normalizeCanonicalUrl(page.url);

    if (!canonical) {
      invalid.push({
        url: page.url,
        canonical: page.canonical,
      });
      continue;
    }

    if (canonical === pageUrl) {
      validSelf.push({ url: page.url, canonical });
      continue;
    }

    const source = new URL(pageUrl);
    const target = new URL(canonical);

    const samePageVariant =
      source.hostname === target.hostname &&
      source.pathname === target.pathname;

    if (samePageVariant) {
      consolidatedVariants.push({
        url: page.url,
        canonical,
      });
    } else {
      review.push({
        url: page.url,
        canonical,
      });
    }
  }

  const needsAttention =
    missing.length > 0 || invalid.length > 0 || review.length > 0;

  const eligibleCount =
    validSelf.length +
    consolidatedVariants.length +
    missing.length +
    invalid.length +
    review.length;

  return {
    id: 'search_canonical_setup',
    category: 'search',
    status:
      needsAttention
        ? 'NEEDS_ATTENTION'
        : eligibleCount > 0
          ? 'PASS'
          : 'NOT_VERIFIED',
    finding: needsAttention
      ? `${missing.length} missing, ${invalid.length} invalid and ${review.length} canonical declaration(s) need review.`
      : 'Canonical declarations were coherent across checked reachable pages.',
    evidence: {
      validSelf,
      consolidatedVariants,
      missing,
      invalid,
      review,
    },
    whyItMatters:
      'Canonical declarations help search systems understand the preferred URL for equivalent or duplicate content.',
    suggestedAction: needsAttention
      ? 'Review the affected canonical declarations and confirm that each preferred URL is intentional.'
      : 'Keep canonical declarations aligned with preferred public URLs.',
  };
}

