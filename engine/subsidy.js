// @ts-check
/** @typedef {import('./types.js').CityRules} CityRules */

/**
 * Central subsidy for residential rooftop solar. Always computed by the platform, never by a vendor.
 * ₹perKwFirst2 per kW for the first 2 kW + ₹thirdKw for the 3rd kW (pro-rata), capped.
 * @param {{kw:number, dcr:boolean, residential?:boolean, requested?:boolean}} input
 * @param {CityRules} rules
 * @returns {{amount:number, eligible:boolean, reason:string|null}}
 */
export function computeSubsidy({ kw, dcr, residential = true, requested = true }, rules) {
  const r = rules.subsidy;
  if (!requested) return { amount: 0, eligible: false, reason: 'Subsidy not requested' };
  if (!residential) return { amount: 0, eligible: false, reason: 'Subsidy applies to residential homes only' };
  if (r.requiresDcr && !dcr) return { amount: 0, eligible: false, reason: 'Subsidy needs DCR (made-in-India cell) panels' };
  const first = Math.min(Math.max(kw, 0), 2) * r.perKwFirst2;
  const third = Math.min(Math.max(kw - 2, 0), 1) * r.thirdKw;
  const amount = Math.round(Math.min(first + third, r.cap));
  return { amount, eligible: amount > 0, reason: null };
}
