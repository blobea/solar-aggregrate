// @ts-check
/** Sanity checks that the seed price sheets produce realistic 2026 Bangalore numbers. */
import { describe, it, expect } from 'vitest';
import { estimate } from './estimate.js';
import { vendorAccuracy } from './accuracy.js';
import rulesJson from '../data/seed/city-rules.json';
import sheetsJson from '../data/seed/price-sheets.json';
import vendorsJson from '../data/seed/vendors.json';
import quotesJson from '../data/seed/final-quotes.json';
import catalogue from '../data/seed/catalogue.json';
import { resolveSeedDates } from '../app/api/seed-dates.js';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const rules = /** @type {any} */ (rulesJson);
const sheets = resolveSeedDates(/** @type {any[]} */ (sheetsJson), NOW);
const vendors = /** @type {any[]} */ (vendorsJson);

/** @param {number} kw @param {any} [prefs] */
const cfg = (kw, prefs = {}) => /** @type {any} */ ({
  pincode: '560102', roofAreaSqm: 80, roofType: 'rcc', floors: 2, structure: 'standard', monthlyUnits: 900, sanctionedLoadKw: 10, kw,
  prefs: { subsidy: true, tier: 'standard', battery: 0, evCharger: 0, finance: false, ...prefs },
});
const run = (/** @type {any} */ c) => sheets.map((sheet) => estimate({ config: c, sheet, rules, vendor: vendors.find((v) => v.id === sheet.vendorId), catalogue, now: NOW })).filter((e) => e.eligible);

describe('seed data', () => {
  it('3 kW standard gross is roughly ₹2.0–2.3 L', () => {
    for (const e of run(cfg(3))) {
      expect(e.gross).toBeGreaterThanOrEqual(195000);
      expect(e.gross).toBeLessThanOrEqual(232000);
    }
  });
  it('5 kW standard gross is roughly ₹2.6–3.0 L', () => {
    for (const e of run(cfg(5))) {
      expect(e.gross).toBeGreaterThanOrEqual(255000);
      expect(e.gross).toBeLessThanOrEqual(302000);
    }
  });
  it('the demo customer sees at least 5 eligible vendors including one stale sheet', () => {
    const demo = { ...cfg(0), roofAreaSqm: 60, monthlyUnits: 450, sanctionedLoadKw: 5, prefs: { subsidy: true, tier: 'standard', battery: 0, evCharger: 7.4, finance: false } };
    delete demo.kw;
    const list = run(demo);
    expect(list.length).toBeGreaterThanOrEqual(5);
    expect(list.some((e) => e.stale)).toBe(true);
    expect(list.every((e) => e.kw === 4)).toBe(true);
  });
  it('accuracy badges vary across vendors', () => {
    const badges = new Set(vendors.map((v) => vendorAccuracy(/** @type {any} */ (quotesJson), v.id).badge));
    expect(badges).toEqual(new Set(['green', 'amber', 'red', 'new']));
  });
});
