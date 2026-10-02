import { crawlSite } from './crawler.mjs';
import {
  checkContactRoutes,
  checkEnquiryPath,
} from './checks/customer.mjs';
import {
  checkPageReachability,
  checkBrokenInternalPaths,
  checkPageIdentification,
  checkCanonicalSetup,
} from './checks/search.mjs';
import {
  checkStructuredDataHealth,
  checkBusinessIdentityMarkup,
  checkIdentityConsistency,
  checkExternalIdentityReferences,
  checkContentStructure,
  checkMobileBasics,
} from './checks/machine.mjs';

export async function runSiteCheck(inputUrl, maxPages = 20) {
  const startedAt = new Date();
  const started = Date.now();

  const crawl = await crawlSite(inputUrl, maxPages);
  const hostname = new URL(crawl.requestedUrl).hostname;

  const contactRoutes = checkContactRoutes(crawl.pages);
  const structuredData = checkStructuredDataHealth(crawl.pages);
  const businessIdentity = checkBusinessIdentityMarkup(structuredData);

  const findings = [
    contactRoutes,
    checkEnquiryPath(crawl.pages, contactRoutes),

    checkPageReachability(crawl.pages),
    checkBrokenInternalPaths(crawl.pages, hostname),
    checkPageIdentification(crawl.pages),
    checkCanonicalSetup(crawl.pages),

    structuredData,
    businessIdentity,
    checkIdentityConsistency(businessIdentity),
    checkExternalIdentityReferences(structuredData, hostname),
    checkContentStructure(crawl.pages),
    checkMobileBasics(crawl.pages),
  ];

  const counts = {
    PASS: 0,
    NEEDS_ATTENTION: 0,
    FAIL: 0,
    NOT_VERIFIED: 0,
  };

  for (const finding of findings) {
    counts[finding.status] += 1;
  }

  return {
    requestedUrl: crawl.requestedUrl,
    pagesChecked: crawl.pagesChecked,
    startedAt: startedAt.toISOString(),
    runtimeMs: Date.now() - started,
    counts,
    findings,
    pages: crawl.pages,
  };
}
