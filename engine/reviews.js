// @ts-check

/**
 * @typedef {'survey'|'install'|'longterm'} Milestone
 * @typedef {'pending_check'|'published'} ReviewStatus
 * @typedef {Object} Dispute
 * @property {string} ground
 * @property {string} [note]
 * @property {string} raisedAt
 * @property {'open'|'removed'|'annotated'|'stands'} outcome
 * @property {string} [opsNote]
 * @property {string} [resolvedAt]
 *
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} vendorId
 * @property {string} customerName
 * @property {Milestone} milestone
 * @property {Record<string, number>} scores   dimension → 1..5
 * @property {Record<string, string>} [reasons] dimension → reason code (required when score ≤ 2)
 * @property {string} [text]
 * @property {string} [evidence]               install: invoice number / photo ref
 * @property {number} [generationReading]      longterm: kWh reading
 * @property {string} createdAt
 * @property {ReviewStatus} status
 * @property {{text:string, at:string}} [reply]
 * @property {Dispute} [dispute]
 * @property {boolean} [resolvedByVendor]
 */

export const DIMENSIONS = {
  quoteAccuracy: 'Quote accuracy',
  timeliness: 'Timeliness',
  workmanship: 'Workmanship',
  paperwork: 'Paperwork & approvals',
  communication: 'Communication',
  afterSales: 'After-sales support',
};

export const MILESTONES = {
  survey: { label: 'Site survey', weight: 1, dims: ['quoteAccuracy', 'timeliness', 'communication'] },
  install: { label: 'Installation', weight: 1.5, dims: ['quoteAccuracy', 'timeliness', 'workmanship', 'paperwork', 'communication'] },
  longterm: { label: 'Long-term (6–12 months)', weight: 1.5, dims: ['workmanship', 'afterSales', 'communication'] },
};

export const REASON_CODES = {
  price_above_estimate: 'Final price above estimate',
  missed_date: 'Missed agreed date',
  poor_workmanship: 'Poor workmanship',
  paperwork_issue: 'Paperwork issue',
  no_response: 'No response',
  discom_delay: 'DISCOM delay (external)',
  subsidy_portal_delay: 'Subsidy portal delay (external)',
  other: 'Other',
};
/** Outside the vendor's control: shown on the review but excluded from the vendor score. */
export const EXTERNAL_CODES = ['discom_delay', 'subsidy_portal_delay'];

export const DISPUTE_GROUNDS = {
  not_a_customer: 'Not a customer',
  factually_false: 'Factually false',
  abusive: 'Abusive',
  extortion: 'Extortion / threat',
  outside_vendor_control: 'Outside vendor control',
};
export const DISPUTE_OUTCOMES = ['removed', 'annotated', 'stands'];

export const RATING_CONFIG = { C: 5, halfLifeDays: 365, fallbackMean: 4.0 };
export const PENDING_CHECK_HOURS = 72;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Validate a submitted review. Returns a list of human-readable errors (empty when valid).
 * @param {Partial<Review>} r
 */
export function validateReview(r) {
  /** @type {string[]} */
  const errors = [];
  const m = r.milestone && MILESTONES[r.milestone];
  if (!m) return ['Unknown milestone'];
  const scores = r.scores || {};
  const reasons = r.reasons || {};
  for (const d of m.dims) {
    const s = scores[d];
    if (!Number.isInteger(s) || s < 1 || s > 5) errors.push(`${DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)]}: choose 1–5`);
    else if (s <= 2 && !(reasons[d] in REASON_CODES)) errors.push(`${DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)]}: a reason is required for scores of 2 or less`);
  }
  if (r.milestone === 'install' && !String(r.evidence || '').trim()) errors.push('Installation reviews need evidence (invoice number or photo)');
  if (r.milestone === 'longterm' && !(Number(r.generationReading) > 0)) errors.push('Long-term reviews need a generation reading');
  return errors;
}

/**
 * Mean score of the dimensions that count toward the vendor. Dimensions with an external reason code are excluded.
 * @param {Review} r @returns {number|null}
 */
export function reviewScore(r) {
  const dims = MILESTONES[r.milestone].dims.filter((d) => r.scores[d] != null && !EXTERNAL_CODES.includes(r.reasons?.[d] ?? ''));
  if (!dims.length) return null;
  return dims.reduce((s, d) => s + r.scores[d], 0) / dims.length;
}

/** @param {Review} r @param {Date|number} now */
export function effectiveStatus(r, now) {
  if (r.status === 'pending_check' && new Date(now).getTime() - new Date(r.createdAt).getTime() >= PENDING_CHECK_HOURS * HOUR_MS) {
    return 'published';
  }
  return r.status;
}

/** Counted toward ratings: published and not removed by Ops. @param {Review} r @param {Date|number} now */
export function isCountable(r, now) {
  return effectiveStatus(r, now) === 'published' && r.dispute?.outcome !== 'removed';
}

/** Shown publicly: published and not removed. Negative reviews are never auto-hidden. */
export const isVisible = isCountable;

/** @param {number} ageDays */
export const recencyWeight = (ageDays, halfLifeDays = RATING_CONFIG.halfLifeDays) => 0.5 ** (Math.max(0, ageDays) / halfLifeDays);

/** City mean score over all countable reviews. @param {Review[]} reviews @param {Date|number} now */
export function cityMean(reviews, now) {
  const scores = reviews.filter((r) => isCountable(r, now)).map(reviewScore).filter((s) => s != null);
  if (!scores.length) return RATING_CONFIG.fallbackMean;
  return /** @type {number[]} */ (scores).reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Bayesian vendor rating: (C·m + Σ wᵢsᵢ) / (C + Σ wᵢ), wᵢ = milestone weight × recency decay.
 * @param {Review[]} vendorReviews reviews for one vendor
 * @param {{m:number, now:Date|number, C?:number}} opts
 */
export function bayesianRating(vendorReviews, { m, now, C = RATING_CONFIG.C }) {
  let sum = 0;
  let n = 0;
  let count = 0;
  for (const r of vendorReviews) {
    if (!isCountable(r, now)) continue;
    const s = reviewScore(r);
    if (s == null) continue;
    const age = (new Date(now).getTime() - new Date(r.createdAt).getTime()) / DAY_MS;
    const w = MILESTONES[r.milestone].weight * recencyWeight(age);
    sum += w * s;
    n += w;
    count++;
  }
  const rating = (C * m + sum) / (C + n);
  return { rating: Math.round(rating * 100) / 100, count, weight: n };
}

/** @param {Review} r @param {string} ground @param {string} note @param {Date|number} now @returns {Review} */
export function raiseDispute(r, ground, note, now) {
  if (!(ground in DISPUTE_GROUNDS)) throw new Error('Unknown dispute ground');
  if (r.dispute && r.dispute.outcome === 'open') throw new Error('Dispute already open');
  return { ...r, dispute: { ground, note, raisedAt: new Date(now).toISOString(), outcome: 'open' } };
}

/** @param {Review} r @param {'removed'|'annotated'|'stands'} outcome @param {string} opsNote @param {Date|number} now @returns {Review} */
export function resolveDispute(r, outcome, opsNote, now) {
  if (!r.dispute || r.dispute.outcome !== 'open') throw new Error('No open dispute');
  if (!DISPUTE_OUTCOMES.includes(outcome)) throw new Error('Unknown outcome');
  return { ...r, dispute: { ...r.dispute, outcome, opsNote, resolvedAt: new Date(now).toISOString() } };
}
