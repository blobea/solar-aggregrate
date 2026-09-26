// @ts-check
/**
 * Objective vendor metrics computed from stored data with the pure engine.
 * Sponsored placement is never an input here.
 */
import { table, now } from './store.js';
import { vendorAccuracy } from '../../engine/accuracy.js';
import { bayesianRating, cityMean, isCountable } from '../../engine/reviews.js';
import { isStale, daysSince } from '../../engine/estimate.js';

/** Latest version of each vendor's sheet. @returns {Record<string, import('../../engine/types.js').PriceSheet>} */
export function latestSheets() {
  /** @type {Record<string, any>} */
  const out = {};
  for (const s of table('priceSheets').all()) {
    const cur = out[/** @type {any} */ (s).vendorId];
    if (!cur || /** @type {any} */ (s).version > cur.version) out[/** @type {any} */ (s).vendorId] = s;
  }
  return out;
}

/** @param {string} vendorId */
export function latestSheet(vendorId) {
  return latestSheets()[vendorId] || null;
}

/**
 * Rating, accuracy and freshness for every vendor.
 * @returns {Record<string, {rating:number, ratingCount:number, accuracy:ReturnType<typeof vendorAccuracy>,
 *   updatedDaysAgo:number|null, stale:boolean, validUntil:string|null, sheetVersion:number|null}>}
 */
export function vendorMetrics() {
  const t = now();
  const reviews = /** @type {import('../../engine/reviews.js').Review[]} */ (table('reviews').all());
  const quotes = /** @type {any[]} */ (table('finalQuotes').all());
  const m = cityMean(reviews, t);
  const sheets = latestSheets();
  /** @type {Record<string, any>} */
  const out = {};
  for (const v of /** @type {any[]} */ (table('vendors').all())) {
    const r = bayesianRating(reviews.filter((x) => x.vendorId === v.id), { m, now: t });
    const s = sheets[v.id];
    out[v.id] = {
      rating: r.rating,
      ratingCount: r.count,
      accuracy: vendorAccuracy(quotes, v.id),
      updatedDaysAgo: s ? daysSince(s.updatedAt, t) : null,
      stale: s ? isStale(s.terms.validUntil, t) : true,
      validUntil: s?.terms.validUntil ?? null,
      sheetVersion: s?.version ?? null,
    };
  }
  return out;
}

/** Visible reviews for a vendor (published and not removed). @param {string} vendorId */
export function visibleReviews(vendorId) {
  const t = now();
  return /** @type {any[]} */ (table('reviews').all()).filter((r) => r.vendorId === vendorId && isCountable(r, t));
}
