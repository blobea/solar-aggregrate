// @ts-check
import { energyCharge, monthlyGeneration } from './sizing.js';
/** @typedef {import('./types.js').CityRules} CityRules */

/**
 * Monthly bill saving for a given generation, with net-metering export credit for surplus units.
 * @param {number} units consumption @param {number} gen generation @param {CityRules} rules
 */
export function monthlyBillSaving(units, gen, rules) {
  const { slabs, exportRate } = rules.tariff;
  const before = energyCharge(units, slabs);
  const imported = Math.max(0, units - gen);
  const exported = Math.max(0, gen - units);
  const after = energyCharge(imported, slabs) - exported * exportRate;
  return { before, after, saving: before - after };
}

/**
 * Savings, payback and a lifetime cumulative series for charting.
 * @param {{kw:number, monthlyUnits:number, netCost:number}} input
 * @param {CityRules} rules
 */
export function computeSavings({ kw, monthlyUnits, netCost }, rules) {
  const gen = monthlyGeneration(kw, rules);
  const first = monthlyBillSaving(monthlyUnits, gen, rules);
  const years = rules.lifetimeYears ?? 25;
  const deg = (rules.degradationPct ?? 0.5) / 100;
  /** @type {{year:number, savings:number, cumulative:number, netPosition:number}[]} */
  const series = [];
  let cumulative = 0;
  let paybackYears = null;
  for (let y = 1; y <= years; y++) {
    const g = gen * (1 - deg) ** (y - 1);
    const annual = monthlyBillSaving(monthlyUnits, g, rules).saving * 12;
    const prevCum = cumulative;
    cumulative += annual;
    if (paybackYears == null && cumulative >= netCost && annual > 0) {
      paybackYears = Math.round((y - 1 + (netCost - prevCum) / annual) * 10) / 10;
    }
    series.push({ year: y, savings: Math.round(annual), cumulative: Math.round(cumulative), netPosition: Math.round(cumulative - netCost) });
  }
  return {
    monthlyGeneration: Math.round(gen),
    monthlyBillBefore: Math.round(first.before),
    monthlyBillAfter: Math.round(first.after),
    monthlySavings: Math.round(first.saving),
    annualSavings: Math.round(first.saving * 12),
    paybackYears,
    lifetimeSavings: Math.round(cumulative),
    series,
  };
}
