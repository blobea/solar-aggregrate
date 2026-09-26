// @ts-check

/**
 * @typedef {Object} FinalQuote
 * @property {string} vendorId
 * @property {number} estimateShown  net estimate the customer saw (₹)
 * @property {number} finalQuote     vendor's post-survey net quote (₹)
 * @property {string} date           ISO date
 */

export const ACCURACY_WINDOW = 20;
export const MIN_QUOTES = 3;
export const BADGE_THRESHOLDS = { green: 0.1, amber: 0.2 };

/** @param {number} finalQuote @param {number} estimateShown */
export function deviation(finalQuote, estimateShown) {
  if (!estimateShown) return 0;
  return Math.abs(finalQuote - estimateShown) / estimateShown;
}

/** @param {number[]} xs */
export function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** @param {number|null} medianDeviation @param {number} count */
export function accuracyBadge(medianDeviation, count) {
  if (count < MIN_QUOTES || medianDeviation == null) return 'new';
  if (medianDeviation <= BADGE_THRESHOLDS.green + 1e-9) return 'green';
  if (medianDeviation <= BADGE_THRESHOLDS.amber + 1e-9) return 'amber';
  return 'red';
}

/**
 * Vendor accuracy over the most recent quotes.
 * @param {FinalQuote[]} quotes all quotes (any vendor)
 * @param {string} vendorId
 */
export function vendorAccuracy(quotes, vendorId) {
  const recent = quotes
    .filter((q) => q.vendorId === vendorId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, ACCURACY_WINDOW);
  const count = recent.length;
  const medianDeviation = count ? median(recent.map((q) => deviation(q.finalQuote, q.estimateShown))) : null;
  const badge = accuracyBadge(medianDeviation, count);
  const pct = medianDeviation == null ? null : Math.round(medianDeviation * 100);
  const label = badge === 'new' ? 'New — not enough data' : `Quotes within ±${pct}% of estimate`;
  return { vendorId, count, medianDeviation, pct, badge, label };
}
