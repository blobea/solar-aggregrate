// @ts-check
/**
 * Reviews: same checks for positive and negative reviews. Nothing is auto-hidden;
 * only Ops can remove a review, via the dispute process.
 */
import { table, delay, clone, now, nowIso, newId } from './store.js';
import { getSession } from './auth.js';
import { attachReview } from './requests.js';
import { validateReview, raiseDispute, resolveDispute as resolveEngine, effectiveStatus, isVisible } from '../../engine/reviews.js';

const reviews = () => table('reviews');
/** @param {any} r */
const withStatus = (r) => ({ ...r, status: effectiveStatus(r, now()) });

/**
 * Submit a review for a lead milestone.
 * @param {{leadId:string, milestone:'survey'|'install'|'longterm', scores:Record<string,number>,
 *   reasons?:Record<string,string>, text?:string, evidence?:string, generationReading?:number}} input
 */
export async function submitReview(input) {
  await delay();
  const s = getSession();
  const lead = /** @type {any} */ (table('leads').all().find((/** @type {any} */ l) => l.id === input.leadId));
  if (!lead || lead.customerId !== s.customerId) return { ok: false, errors: ['You can only review your own requests'] };
  if (lead.reviews[input.milestone]) return { ok: false, errors: ['Already reviewed'] };
  // keep only reasons for low scores
  /** @type {Record<string,string>} */
  const reasons = {};
  for (const [d, code] of Object.entries(input.reasons || {})) if ((input.scores[d] ?? 5) <= 2 && code) reasons[d] = code;
  const draft = { ...input, reasons };
  const errors = validateReview(draft);
  if (errors.length) return { ok: false, errors };
  const review = {
    id: newId('rev'), vendorId: lead.vendorId, requestId: lead.id, customerName: lead.customerName,
    milestone: input.milestone, scores: input.scores, reasons, text: input.text || '',
    evidence: input.evidence || undefined, generationReading: input.generationReading || undefined,
    createdAt: nowIso(), status: 'pending_check',
  };
  reviews().insert(review);
  attachReview(lead.id, input.milestone, review.id);
  return { ok: true, errors: [], review: clone(review) };
}

/**
 * Public reviews for a vendor profile, with optional filters.
 * @param {string} vendorId
 * @param {{milestone?:string, minScore?:number, maxScore?:number, withReply?:boolean}} [f]
 */
export async function listVendorReviews(vendorId, f = {}) {
  await delay();
  const t = now();
  return clone(/** @type {any[]} */ (reviews().all())
    .filter((r) => r.vendorId === vendorId && isVisible(r, t))
    .filter((r) => !f.milestone || r.milestone === f.milestone)
    .map(withStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/** Vendor portal: all reviews for the vendor including pending and removed ones. @param {string} vendorId */
export async function listReviewsForVendorPortal(vendorId) {
  await delay();
  return clone(/** @type {any[]} */ (reviews().all()).filter((r) => r.vendorId === vendorId).map(withStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/** Customer: their own reviews. */
export async function listMyReviews() {
  await delay();
  const s = getSession();
  const myLeads = new Set(/** @type {any[]} */ (table('leads').all()).filter((l) => l.customerId === s.customerId).map((l) => l.id));
  return clone(/** @type {any[]} */ (reviews().all()).filter((r) => myLeads.has(r.requestId)).map(withStatus));
}

/** @param {string} id @param {string} text */
export async function replyToReview(id, text) {
  await delay();
  if (!String(text).trim()) throw new Error('Reply cannot be empty');
  return clone(reviews().update(id, (r) => ({ ...r, reply: { text: String(text).trim(), at: nowIso() } })));
}

/** @param {string} id @param {string} ground @param {string} note */
export async function disputeReview(id, ground, note) {
  await delay();
  return clone(reviews().update(id, (r) => raiseDispute(r, ground, note, now())));
}

/** Ops. @param {string} id @param {'removed'|'annotated'|'stands'} outcome @param {string} note */
export async function resolveDispute(id, outcome, note) {
  await delay();
  if (!String(note).trim()) throw new Error('Add a note explaining the decision');
  return clone(reviews().update(id, (r) => resolveEngine(r, outcome, note.trim(), now())));
}

/** Customer marks their review as resolved by the vendor. @param {string} id */
export async function markResolvedByVendor(id) {
  await delay();
  return clone(reviews().update(id, (r) => ({ ...r, resolvedByVendor: true })));
}

/** Ops disputes queue: open first, then recently resolved. */
export async function listDisputes() {
  await delay();
  const vendors = Object.fromEntries(/** @type {any[]} */ (table('vendors').all()).map((v) => [v.id, v.name]));
  const leads = /** @type {any[]} */ (table('leads').all());
  return clone(/** @type {any[]} */ (reviews().all())
    .filter((r) => r.dispute)
    .map((r) => {
      const lead = leads.find((l) => l.id === r.requestId);
      return { ...withStatus(r), vendorName: vendors[r.vendorId], lead: lead ? { id: lead.id, status: lead.status, estimate: lead.estimate, finalQuote: lead.finalQuote, invoiceNo: lead.invoiceNo, history: lead.history } : null };
    })
    .sort((a, b) => (a.dispute.outcome === 'open' ? 0 : 1) - (b.dispute.outcome === 'open' ? 0 : 1) || b.dispute.raisedAt.localeCompare(a.dispute.raisedAt)));
}
