// @ts-check
/** @typedef {import('./types.js').CityRules} CityRules */
/** @typedef {import('./types.js').TariffSlab} TariffSlab */

/** @param {number} x */
export const roundUpToHalf = (x) => Math.ceil(x * 2 - 1e-9) / 2;
/** @param {number} x */
export const roundDownToHalf = (x) => Math.floor(x * 2 + 1e-9) / 2;

/**
 * Recommended system size for a home.
 * recommendedKw = min(roundUpToHalf(units / (yield*30)), roundDownToHalf(roof / areaPerKw), sanctionedLoad), minimum 1 kW.
 * @param {{monthlyUnits:number, roofAreaSqm:number, sanctionedLoadKw:number}} input
 * @param {CityRules} rules
 */
export function recommendKw({ monthlyUnits, roofAreaSqm, sanctionedLoadKw }, rules) {
  const minKw = rules.minKw ?? 1;
  const byUsage = roundUpToHalf(Math.max(0, monthlyUnits) / (rules.yieldPerKwDay * 30));
  const byRoof = roundDownToHalf(Math.max(0, roofAreaSqm) / rules.areaPerKwSqm);
  const bySanctioned = Math.max(0, sanctionedLoadKw);
  const raw = Math.min(byUsage, byRoof, bySanctioned);
  /** @type {'usage'|'roof'|'sanctioned'} */
  let limitingFactor = 'usage';
  if (raw === byRoof && byRoof < byUsage) limitingFactor = 'roof';
  if (raw === bySanctioned && bySanctioned < byUsage && bySanctioned <= byRoof) limitingFactor = 'sanctioned';
  const recommendedKw = Math.max(minKw, raw);
  const maxKw = Math.max(minKw, roundDownToHalf(Math.min(byRoof, bySanctioned)));
  /** @type {string[]} */
  const warnings = [];
  if (raw < minKw) warnings.push(`Roof or load supports less than ${minKw} kW; ${minKw} kW is the minimum system.`);
  return { recommendedKw, byUsage, byRoof, bySanctioned, limitingFactor, minKw, maxKw, warnings };
}

/**
 * Clamp a user-chosen size to the allowed range, snapped to 0.5 kW.
 * @param {number} requested
 * @param {{minKw:number, maxKw:number}} limits
 */
export function clampKw(requested, { minKw, maxKw }) {
  const snapped = Math.round(requested * 2) / 2;
  return Math.min(maxKw, Math.max(minKw, snapped));
}

/** @param {number} kw @param {CityRules} rules */
export const monthlyGeneration = (kw, rules) => kw * rules.yieldPerKwDay * 30;

/**
 * Energy charge for a month's consumption under slab tariffs.
 * @param {number} units
 * @param {TariffSlab[]} slabs  ascending by upTo; last may have upTo null
 */
export function energyCharge(units, slabs) {
  let remaining = Math.max(0, units);
  let prev = 0;
  let total = 0;
  for (const s of slabs) {
    const cap = s.upTo == null ? Infinity : s.upTo - prev;
    const used = Math.min(remaining, cap);
    total += used * s.rate;
    remaining -= used;
    if (s.upTo != null) prev = s.upTo;
    if (remaining <= 0) break;
  }
  return total;
}

/**
 * Convert a monthly bill (energy charge portion) back into units. Inverse of energyCharge.
 * @param {number} amount ₹
 * @param {TariffSlab[]} slabs
 */
export function billToUnits(amount, slabs) {
  let remaining = Math.max(0, amount);
  let prev = 0;
  let units = 0;
  for (const s of slabs) {
    const cap = s.upTo == null ? Infinity : s.upTo - prev;
    const slabCost = cap * s.rate;
    if (remaining <= slabCost) return Math.round(units + remaining / s.rate);
    units += cap;
    remaining -= slabCost;
    if (s.upTo != null) prev = s.upTo;
  }
  return Math.round(units);
}
