// @ts-check
/**
 * Survey requests ("leads"): one row per (customer request, vendor).
 * The estimate attached to a lead is a snapshot of the logged estimate the customer saw.
 */
import { table, delay, clone, now, nowIso, newId, onSeed, advanceClock } from './store.js';
import { getSession } from './auth.js';
import { logEntry, computeEstimates } from './estimates.js';

export const STATUS_FLOW = ['sent', 'survey_scheduled', 'survey_done', 'quote_received', 'installed'];
export const STATUS_LABELS = {
  sent: 'Request sent', survey_scheduled: 'Survey scheduled', survey_done: 'Survey done',
  quote_received: 'Final quote received', installed: 'Installed',
};
export const MAX_VENDORS = 3;
export const LONGTERM_AFTER_DAYS = 180;
const DAY_MS = 86_400_000;

const leads = () => table('leads');
/** @param {string} id */
const findLead = (id) => /** @type {any} */ (leads().all().find((/** @type {any} */ l) => l.id === id));

/** @param {any} lead @param {string} status @param {string} [note] */
function pushStatus(lead, status, note) {
  lead.status = status;
  lead.history.push({ status, at: nowIso(), note: note || null });
  return lead;
}

/**
 * Create survey requests for up to 3 vendors. Consent is required and never pre-ticked.
 * @param {{logIds: string[], consent: boolean, name: string, address: string}} input
 */
export async function createRequests({ logIds, consent, name, address }) {
  await delay();
  const s = getSession();
  if (!s.customerId) return { ok: false, error: 'Please verify your phone first' };
  if (!consent) return { ok: false, error: 'Please tick the consent box to share your details' };
  if (!logIds.length || logIds.length > MAX_VENDORS) return { ok: false, error: `Choose 1–${MAX_VENDORS} vendors` };
  if (!String(name).trim() || !String(address).trim()) return { ok: false, error: 'Name and address are required' };
  table('customers').update(s.customerId, (c) => ({ ...c, name, address }));
  const requestId = newId('req');
  const created = [];
  for (const logId of logIds) {
    const e = logEntry(logId);
    if (!e) return { ok: false, error: 'Estimate expired — please refresh results' };
    created.push(makeLead({ requestId, customerId: s.customerId, customerName: name, phone: s.phone, address, entry: e }));
  }
  const rows = leads().all();
  leads().save([...rows, ...created]);
  return { ok: true, requestId, leads: clone(created) };
}

/** @param {{requestId:string, customerId:string, customerName:string, phone:string|null, address:string, entry:any, createdAt?:string}} p */
function makeLead({ requestId, customerId, customerName, phone, address, entry, createdAt }) {
  const at = createdAt || nowIso();
  return {
    id: newId('lead'), requestId, vendorId: entry.vendorId, vendorName: entry.vendorName,
    customerId, customerName, phone, address, config: entry.config,
    estimate: {
      logId: entry.id, kw: entry.kw, gross: entry.gross, subsidy: entry.subsidy, net: entry.net,
      low: entry.low, high: entry.high, packageId: entry.packageId, packageName: entry.packageName, lineItems: entry.lineItems,
      sheetVersion: entry.sheetVersion, shownAt: entry.at,
    },
    status: 'sent', history: [{ status: 'sent', at, note: null }],
    survey: { scheduledFor: null, doneAt: null, confirmedByCustomer: false },
    finalQuote: null, installedAt: null, invoiceNo: null,
    reviews: { survey: null, install: null, longterm: null }, createdAt: at,
  };
}

export async function listMyRequests() {
  await delay();
  const s = getSession();
  return clone(/** @type {any[]} */ (leads().all()).filter((l) => l.customerId === s.customerId).reverse());
}

/** @param {string} vendorId */
export async function listLeads(vendorId) {
  await delay();
  return clone(/** @type {any[]} */ (leads().all()).filter((l) => l.vendorId === vendorId).reverse());
}

/** @param {string} id */
export async function getLead(id) {
  await delay();
  return clone(findLead(id) || null);
}

/** Which review milestones the customer can review now. @param {any} lead */
export function reviewPrompts(lead) {
  /** @type {('survey'|'install'|'longterm')[]} */
  const out = [];
  const idx = STATUS_FLOW.indexOf(lead.status);
  if (idx >= 2 && lead.survey.confirmedByCustomer && !lead.reviews.survey) out.push('survey');
  if (lead.status === 'installed' && !lead.reviews.install) out.push('install');
  if (lead.status === 'installed' && lead.installedAt && !lead.reviews.longterm
    && now() - new Date(lead.installedAt).getTime() >= LONGTERM_AFTER_DAYS * DAY_MS) out.push('longterm');
  return out;
}

// ---- Vendor actions -------------------------------------------------------

/** @param {string} id @param {(lead:any) => any} fn */
async function mutate(id, fn) {
  await delay();
  return clone(leads().update(id, fn));
}

/** @param {string} id @param {string} date ISO date */
export const scheduleSurvey = (id, date) => mutate(id, (l) => {
  if (l.status !== 'sent') throw new Error('Survey already scheduled');
  l.survey.scheduledFor = date;
  return pushStatus(l, 'survey_scheduled', `Survey on ${date.slice(0, 10)}`);
});

/** @param {string} id */
export const markSurveyDone = (id) => mutate(id, (l) => {
  if (!['sent', 'survey_scheduled'].includes(l.status)) throw new Error('Survey already done');
  l.survey.doneAt = nowIso();
  return pushStatus(l, 'survey_done');
});

/** @param {string} id @param {number} amount net final quote ₹ @param {string} [note] */
export async function logFinalQuote(id, amount, note = '') {
  const a = Math.round(Number(amount));
  if (!(a > 10000)) throw new Error('Enter the final quote in ₹');
  const lead = await mutate(id, (l) => {
    if (!['survey_done', 'survey_scheduled', 'sent'].includes(l.status)) throw new Error('Quote already logged');
    if (!l.survey.doneAt) l.survey.doneAt = nowIso();
    l.finalQuote = { amount: a, note, at: nowIso() };
    return pushStatus(l, 'quote_received', `Final quote ₹${a.toLocaleString('en-IN')}`);
  });
  table('finalQuotes').insert({ id: newId('fq'), vendorId: lead.vendorId, requestId: lead.id, estimateShown: lead.estimate.net, finalQuote: a, date: nowIso() });
  return lead;
}

/** @param {string} id @param {string} invoiceNo */
export const markInstalled = (id, invoiceNo) => mutate(id, (l) => {
  if (l.status !== 'quote_received') throw new Error('Log the final quote first');
  l.installedAt = nowIso();
  l.invoiceNo = invoiceNo || null;
  return pushStatus(l, 'installed', invoiceNo ? `Invoice ${invoiceNo}` : undefined);
});

// ---- Customer actions -----------------------------------------------------

/** @param {string} id */
export const confirmSurvey = (id) => mutate(id, (l) => {
  if (!l.survey.doneAt) throw new Error('Vendor has not marked the survey done');
  l.survey.confirmedByCustomer = true;
  return l;
});

/** Link a submitted review to the lead. @param {string} id @param {string} milestone @param {string} reviewId */
export function attachReview(id, milestone, reviewId) {
  leads().update(id, (l) => { l.reviews[milestone] = reviewId; return l; });
}

// ---- Demo: advance time ---------------------------------------------------

/**
 * Move a lead to its next milestone (doing the vendor's step with demo values) and advance the demo
 * clock by 4 days so pending review checks (72 h) complete. After install it jumps 6 months for the long-term review.
 * @param {string} id
 */
export async function advanceLead(id) {
  const l = findLead(id);
  if (!l) throw new Error('Lead not found');
  switch (l.status) {
    case 'sent': await scheduleSurvey(id, new Date(now() + 2 * DAY_MS).toISOString()); break;
    case 'survey_scheduled': await markSurveyDone(id); break;
    case 'survey_done': await logFinalQuote(id, Math.round((l.estimate.net * 1.04) / 100) * 100, 'Demo: auto-logged'); break;
    case 'quote_received': await markInstalled(id, `INV-DEMO-${Math.floor(now() / 1000) % 100000}`); break;
    case 'installed': advanceClock(LONGTERM_AFTER_DAYS + 1); return getLead(id);
  }
  advanceClock(4);
  return getLead(id);
}

// ---- Seed: turn seed requests into leads with real logged estimates --------

onSeed(() => {
  /** @type {any[]} */ (table('seedRequests').all()).forEach(seedOne);
});

/** @param {any} r @param {number} i */
function seedOne(r, i) {
  const customerId = `cust-seed-${i + 1}`;
  const res = computeEstimates(r.config, 'best', { customerId, name: r.customerName, phone: r.phone });
  const created = [];
  for (const [j, vendorId] of r.vendorIds.entries()) {
    const card = [...res.organic].find((c) => c.vendorId === vendorId);
    if (!card) continue;
    const lead = makeLead({ requestId: `req-seed-${i + 1}`, customerId, customerName: r.customerName, phone: r.phone, address: r.address, entry: logEntry(card.logId), createdAt: r.createdAt });
    const target = STATUS_FLOW.indexOf(r.statuses[j]);
    for (let k = 1; k <= target; k++) {
      lead.status = STATUS_FLOW[k];
      lead.history.push({ status: STATUS_FLOW[k], at: r.createdAt, note: null });
      if (STATUS_FLOW[k] === 'survey_scheduled') lead.survey.scheduledFor = new Date(now() + 2 * DAY_MS).toISOString();
      if (STATUS_FLOW[k] === 'survey_done') lead.survey.doneAt = r.createdAt;
    }
    created.push(lead);
  }
  leads().save([...leads().all(), ...created]);
}
