// @ts-check
/**
 * Seed files store dates relative to "now" as "@-40d" / "@+30d" so the demo never goes stale.
 * Pure helper, also used by engine tests that load the real seed.
 */
const REL = /^@([+-]\d+)d$/;
const DAY_MS = 86_400_000;

/**
 * Deep-copy `value`, replacing every "@±Nd" string with an ISO timestamp relative to `now`.
 * @template T
 * @param {T} value
 * @param {number} now epoch ms
 * @returns {T}
 */
export function resolveSeedDates(value, now) {
  if (typeof value === 'string') {
    const m = REL.exec(value);
    return /** @type {any} */ (m ? new Date(now + Number(m[1]) * DAY_MS).toISOString() : value);
  }
  if (Array.isArray(value)) return /** @type {any} */ (value.map((v) => resolveSeedDates(v, now)));
  if (value && typeof value === 'object') {
    return /** @type {any} */ (Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveSeedDates(v, now)])));
  }
  return value;
}
