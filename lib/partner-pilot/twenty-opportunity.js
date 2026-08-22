/**
 * twenty-opportunity.js
 *
 * Creates or updates an Opportunity in Twenty CRM tied to a Person.
 * The Opportunity carries the full outreach context:
 *   – outreach text actually sent
 *   – platform used (crisp, intercom, email, linkedin, …)
 *   – optimal time of day / day of week to reach this contact
 *   – their reply and classification
 *   – next recommended human action
 *
 * Twenty REST schema used (best-effort; gracefully degraded on missing endpoints):
 *   POST /rest/opportunities           → primary
 *   POST /rest/activities  (type=Opportunity) → fallback
 *   POST /rest/notes                   → last fallback
 *
 * Environment:
 *   TWENTY_BASE_URL  (default http://107.172.94.35:3002)
 *   TWENTY_API_KEY   (from Infisical)
 */

const TWENTY_BASE = process.env.TWENTY_BASE_URL || 'http://107.172.94.35:3002';
const TWENTY_KEY  = process.env.TWENTY_API_KEY  || '';

const HEADERS = {
  Authorization: `Bearer ${TWENTY_KEY}`,
  'Content-Type': 'application/json',
};

async function api(method, path, payload) {
  const url = `${TWENTY_BASE}/${path.replace(/^\//, '')}`;
  const opts = { method, headers: HEADERS };
  if (payload) opts.body = JSON.stringify(payload);
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twenty ${resp.status}: ${text}`);
  }
  const body = await resp.text();
  return body ? JSON.parse(body) : {};
}

// ─── Company helpers ─────────────────────────────────────────────

async function findOrCreateCompany(name) {
  try {
    const list = await api('GET', '/rest/companies?limit=500');
    const items = list?.data?.companies || [];
    const found = items.find(c => (c?.name || '').toLowerCase() === name.toLowerCase());
    if (found) return found;
  } catch {}
  try {
    const created = await api('POST', '/rest/companies', { name });
    return created?.data?.createCompany || created?.data?.company || created;
  } catch {
    return null;
  }
}

async function updateCompany(companyId, patch) {
  try {
    return await api('PATCH', `/rest/companies/${companyId}`, patch);
  } catch {
    return null;
  }
}

// ─── Person helpers ──────────────────────────────────────────────

async function findOrCreatePerson(companyId, firstName, lastName, extras) {
  try {
    const list = await api('GET', '/rest/people?limit=500');
    const items = (list?.data?.people || []).filter(p => p.companyId === companyId);
    // Match by name
    const found = items.find(p =>
      (p?.name?.firstName || '').toLowerCase() === firstName.toLowerCase() &&
      (p?.name?.lastName  || '').toLowerCase() === lastName.toLowerCase()
    );
    if (found) return found;
  } catch {}
  try {
    const created = await api('POST', '/rest/people', {
      name: { firstName, lastName },
      companyId,
      ...extras,
    });
    return created?.data?.createPerson || created?.data?.person || created;
  } catch {
    return null;
  }
}

// ─── Opportunity helpers ─────────────────────────────────────────

async function createOpportunity(payload) {
  try {
    const resp = await api('POST', '/rest/opportunities', payload);
    return resp?.data?.createOpportunity || resp?.data?.opportunity || resp;
  } catch (err) {
    throw err; // Let caller decide fallback
  }
}

async function createNote(parentType, parentId, title, body) {
  try {
    const resp = await api('POST', '/rest/notes', {
      title,
      body,
      [`${parentType}Id`]: parentId,
    });
    return resp;
  } catch {
    // Try activity fallback
    try {
      const resp = await api('POST', '/rest/activities', {
        type: 'Note',
        title,
        body,
        [`${parentType}Id`]: parentId,
      });
      return resp;
    } catch {
      return null;
    }
  }
}

// ─── Stage / Pipeline helpers ────────────────────────────────────

async function getPipelineStage(pipelineName = 'Sales', stageName = 'New') {
  try {
    const pipelines = await api('GET', '/rest/pipelines?limit=50');
    const pipeList = pipelines?.data?.pipelines || [];
    const pipe = pipeList.find(p => (p?.name || '').toLowerCase().includes(pipelineName.toLowerCase()));
    if (!pipe) return null;
    const stages = pipe?.stages || [];
    return stages.find(s => (s?.name || '').toLowerCase() === stageName.toLowerCase())?.id || stages[0]?.id || null;
  } catch {
    return null;
  }
}

// ─── Main export ─────────────────────────────────────────────────

async function upsertPartnerOpportunity({
  companyName,
  targetSlug,
  personFirstName = 'Partnerships',
  personLastName  = 'Contact',
  personExtras    = {},

  // Outreach context
  outreachText,
  platform,
  optimalTiming,   // { time_of_day, day_of_week[], timezone, backup_window, rationale }

  // Reply context
  replyText,
  replySentiment,
  replyConfidence,

  // Next action
  nextAction,
  nextRationale,

  // Business
  estimatedValue = 0,           // placeholder; counsel will set later
  closeDate,                   // defaults to T+90 days
}) {
  if (!TWENTY_KEY) {
    console.log('[! TWENTY_API_KEY not set — skipping Twenty sync]');
    return { success: false, reason: 'missing_api_key' };
  }

  // 1. Company
  const company = await findOrCreateCompany(companyName);
  if (!company) return { success: false, reason: 'company_create_failed' };
  await updateCompany(company.id, {
    outreachStatus: 'POSITIVE_INTERESTED',
    ...(company.domain ? {} : { domain: `${targetSlug}.com` }),
  });

  // 2. Person (point of contact)
  const websiteUrl = personExtras.linkedinUrl || `https://${targetSlug}.com`;
  const person = await findOrCreatePerson(company.id, personFirstName, personLastName, {
    ...personExtras,
    linkedinLink: { primaryLinkUrl: websiteUrl, primaryLinkLabel: 'Website' },
  });
  if (!person) return { success: false, reason: 'person_create_failed' };

  // 3. Build Opportunity payload
  const today = new Date();
  const targetClose = closeDate || new Date(today.setDate(today.getDate() + 90)).toISOString().split('T')[0];
  const stageId = await getPipelineStage('Sales', 'New');

  const description = [
    `**Outreach Platform:** ${platform || 'unknown'}`,
    `**Outreach Text Sent:**`,
    outreachText || '(not recorded)',
    '',
    `**Optimal Timing:**`,
    `- Time of day: ${optimalTiming?.time_of_day || 'TBD'}`,
    `- Day(s): ${(optimalTiming?.day_of_week || []).join(', ')}`,
    `- Timezone: ${optimalTiming?.timezone || 'TBD'}`,
    `- Backup: ${optimalTiming?.backup_window || 'TBD'}`,
    `- Rationale: ${optimalTiming?.rationale || ''}`,
    '',
    `**Reply Received:**`,
    replyText || '(no reply yet)',
    '',
    `**Reply Classification:** ${replySentiment || 'unknown'} (${replyConfidence || 'unknown'})`,
    '',
    `**Recommended Next Action:** ${nextAction || 'TBD'}`,
    `_${nextRationale || ''}_`,
  ].join('\n');

  let opportunity;
  try {
    opportunity = await createOpportunity({
      name: `${companyName} — Partner Pilot`,
      companyId: company.id,
      personId: person.id,
      amount: { amountMicros: estimatedValue * 1_000_000, currencyCode: 'USD' },
      closeDate: targetClose,
      stageId: stageId || undefined,
      description,
    });
    console.log(`[+ Opportunity] ${opportunity?.name || opportunity?.id}`);
  } catch (err) {
    console.log(`[! Opportunity create failed: ${err.message}. Falling back to Note on Person.]`);
    opportunity = null;
  }

  // 4. Note fallback (attach to Person if Opportunity failed, else to Opportunity)
  const noteTargetType = opportunity ? 'opportunity' : 'person';
  const noteTargetId   = opportunity ? opportunity.id : person.id;
  const note = await createNote(
    noteTargetType,
    noteTargetId,
    `Outreach context — ${new Date().toISOString().split('T')[0]}`,
    description,
  );

  return {
    success: true,
    companyId: company.id,
    companyName: company.name,
    personId: person.id,
    opportunityId: opportunity?.id || null,
    noteId: note?.id || null,
    stageId: stageId || null,
    syncedAt: new Date().toISOString(),
  };
}

module.exports = {
  upsertPartnerOpportunity,
  findOrCreateCompany,
  findOrCreatePerson,
  createOpportunity,
  getPipelineStage,
};
