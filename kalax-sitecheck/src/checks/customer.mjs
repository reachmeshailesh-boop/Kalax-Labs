function uniqueEvidence(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.sourceUrl}|${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function checkContactRoutes(pages) {
  const phone = [];
  const email = [];
  const whatsapp = [];
  const enquiry = [];

  for (const page of pages) {
    for (const link of page.links || []) {
      const href = link.href || '';
      const text = link.text || '';
      const lowerHref = href.toLowerCase();
      const lowerText = text.toLowerCase();

      const evidence = {
        sourceUrl: page.url,
        text,
        href,
      };

      if (lowerHref.startsWith('tel:')) phone.push(evidence);
      if (lowerHref.startsWith('mailto:')) email.push(evidence);

      if (
        lowerHref.includes('wa.me/') ||
        lowerHref.includes('whatsapp.com/')
      ) {
        whatsapp.push(evidence);
      }

      let pathname = '';
      try {
        pathname = new URL(href).pathname.toLowerCase();
      } catch {}

      const enquiryPath =
        /\/(contact|enquiry|inquiry|quote|get-started|request-demo|schedule|appointment)(\/|$)/.test(
          pathname,
        );

      const enquiryText =
        /^(contact( us)?|enquire|inquire|request (a )?quote|get started|request demo|schedule (a )?(call|consultation|appointment)|book (a )?(call|consultation|appointment))$/i.test(
          text.trim(),
        );

      if (enquiryPath || enquiryText) {
        enquiry.push(evidence);
      }
    }
  }

  const routes = {
    phone: uniqueEvidence(phone),
    email: uniqueEvidence(email),
    whatsapp: uniqueEvidence(whatsapp),
    enquiry: uniqueEvidence(enquiry),
  };

  const available = Object.entries(routes)
    .filter(([, evidence]) => evidence.length > 0)
    .map(([type]) => type);

  return {
    id: 'customer_contact_routes',
    category: 'customer',
    status: available.length > 0 ? 'PASS' : 'NEEDS_ATTENTION',
    finding:
      available.length > 0
        ? `Customer contact routes found: ${available.join(', ')}.`
        : 'No clear customer contact route was found.',
    evidence: routes,
    whyItMatters:
      'Visitors should be able to find a clear way to contact or enquire with the business.',
    suggestedAction:
      available.length > 0
        ? 'Keep important contact routes easy to find across the customer journey.'
        : 'Add a clearly discoverable phone, email, WhatsApp or enquiry route.',
  };
}

export function checkEnquiryPath(pages, contactFinding) {
  const linkedRoutes = contactFinding?.evidence?.enquiry || [];

  const forms = pages.flatMap((page) =>
    (page.forms || []).map((form) => ({
      sourceUrl: page.url,
      ...form,
    })),
  );

  const hasPath = linkedRoutes.length > 0 || forms.length > 0;

  return {
    id: 'customer_enquiry_path',
    category: 'customer',
    status: hasPath ? 'PASS' : 'NEEDS_ATTENTION',
    finding: hasPath
      ? 'A customer enquiry path was found.'
      : 'No clear enquiry path or form was found.',
    evidence: {
      links: linkedRoutes,
      forms,
    },
    whyItMatters:
      'A visitor who is ready to engage should have a clear route to start a conversation.',
    suggestedAction: hasPath
      ? 'Keep the enquiry route prominent and easy to understand.'
      : 'Provide a clear contact, enquiry, consultation or request route.',
  };
}
