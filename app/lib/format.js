// @ts-check
/** Display formatting helpers (Indian numbering). */

/** ₹1,23,456 @param {number|null|undefined} n */
export function inr(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
}

/** ₹1.23 L @param {number|null|undefined} n */
export function lakh(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹${(n / 100000).toFixed(2)} L`;
}

/** ₹1.18–1.42 L @param {number} lo @param {number} hi */
export function lakhRange(lo, hi) {
  return `₹${(lo / 100000).toFixed(2)}–${(hi / 100000).toFixed(2)} L`;
}

/** @param {string|number|Date|null|undefined} d */
export function date(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** @param {string|number|Date|null|undefined} d */
export function dateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "updated 3 days ago" @param {number|null|undefined} days */
export function daysAgo(days) {
  if (days == null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** @param {number} n @param {number} [d] */
export const num = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));

/** Star string for aria-hidden display. @param {number} rating */
export function stars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** @param {string} s */
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Badge css class for accuracy badge. @param {string} b */
export const badgeClass = (b) => ({ green: 'badge-green', amber: 'badge-amber', red: 'badge-red', new: 'badge-new' })[b] || '';

export const TIER_LABELS = { economy: 'Economy', standard: 'Standard', premium: 'Premium' };
export const ROOF_LABELS = { rcc: 'RCC (concrete)', sheet: 'Metal sheet', tile: 'Clay tile' };
export const STRUCTURE_LABELS = { standard: 'Standard (flush)', elevated_6ft: 'Elevated 6 ft', elevated_10ft: 'Elevated 10 ft' };

export const PRICE_DISCLAIMER = "Indicative estimate from the vendor's price sheet; final price after site survey.";
