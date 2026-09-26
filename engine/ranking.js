// @ts-check

/**
 * Weights for "Best match". Shown verbatim on the How-we-rank page. Must sum to 1.
 */
export const RANKING_WEIGHTS = { price: 0.35, rating: 0.25, accuracy: 0.3, freshness: 0.1 };
export const SPONSOR_RULES = { minRating: 3.5, maxSlots: 1 };
export const FRESHNESS_FULL_DAYS = 30;
export const FRESHNESS_ZERO_DAYS = 120;

/**
 * @typedef {Object} RankItem
 * @property {string} vendorId
 * @property {number} net
 * @property {number} rating          Bayesian rating 0..5
 * @property {number|null} accuracyDeviation  median deviation or null when new
 * @property {number} updatedDaysAgo
 * @property {boolean} stale
 * @property {boolean} [sponsored]    vendor has bought the sponsored slot
 */

/** @param {RankItem} it */
export function freshnessScore(it) {
  if (it.stale) return 0;
  const d = it.updatedDaysAgo;
  if (d <= FRESHNESS_FULL_DAYS) return 1;
  return Math.max(0.1, 1 - (d - FRESHNESS_FULL_DAYS) / (FRESHNESS_ZERO_DAYS - FRESHNESS_FULL_DAYS));
}

/** @param {number|null} dev */
export function accuracyScore(dev) {
  if (dev == null) return 0.5; // new vendors: neutral
  return Math.max(0, 1 - dev / 0.3);
}

/**
 * Component scores (0..1) and weighted total for each item.
 * @param {RankItem[]} items
 * @param {typeof RANKING_WEIGHTS} [weights]
 */
export function scoreItems(items, weights = RANKING_WEIGHTS) {
  const nets = items.map((i) => i.net);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  return items.map((it) => {
    const parts = {
      price: max === min ? 1 : (max - it.net) / (max - min),
      rating: Math.max(0, Math.min(1, it.rating / 5)),
      accuracy: accuracyScore(it.accuracyDeviation),
      freshness: freshnessScore(it),
    };
    let score = parts.price * weights.price + parts.rating * weights.rating + parts.accuracy * weights.accuracy + parts.freshness * weights.freshness;
    if (it.stale) score -= 0.15; // stale sheets rank lower, never hidden
    return { ...it, parts, score: Math.round(score * 1000) / 1000 };
  });
}

/** @type {Record<string, (a:any, b:any) => number>} */
const SORTS = {
  best: (a, b) => b.score - a.score,
  price: (a, b) => a.net - b.net,
  rating: (a, b) => b.rating - a.rating,
  accuracy: (a, b) => (a.accuracyDeviation ?? 9) - (b.accuracyDeviation ?? 9),
};

/**
 * Rank eligible vendors. The sponsored slot is chosen separately and never changes the organic order:
 * the sponsored vendor still appears at its organic position.
 * @param {RankItem[]} items
 * @param {{sort?: 'best'|'price'|'rating'|'accuracy', sponsorEnabled?: boolean}} [opts]
 */
export function rankVendors(items, { sort = 'best', sponsorEnabled = true } = {}) {
  const scored = scoreItems(items);
  const cmp = SORTS[sort] || SORTS.best;
  const organic = [...scored].sort((a, b) => {
    // stale always after fresh within any sort
    if (a.stale !== b.stale) return a.stale ? 1 : -1;
    return cmp(a, b) || a.vendorId.localeCompare(b.vendorId);
  });
  const sponsored = sponsorEnabled ? pickSponsored(scored) : null;
  return { organic, sponsored };
}

/**
 * At most one sponsored vendor: must have bought the slot, a fresh sheet and rating ≥ minRating.
 * @template {RankItem} T
 * @param {T[]} items
 * @returns {T|null}
 */
export function pickSponsored(items) {
  const ok = items
    .filter((i) => i.sponsored && !i.stale && i.rating >= SPONSOR_RULES.minRating)
    .sort((a, b) => a.vendorId.localeCompare(b.vendorId));
  return ok[0] ?? null;
}
