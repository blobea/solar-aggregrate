// @ts-check
import { describe, it, expect } from 'vitest';
import { computeSavings, monthlyBillSaving } from './savings.js';
import { rules } from './fixtures.test-helper.js';

describe('savings', () => {
  it('saves the whole bill when generation covers usage and credits exports', () => {
    const s = monthlyBillSaving(450, 504, rules());
    expect(s.before).toBeCloseTo(2980);
    expect(s.after).toBeCloseTo(-54 * 3.8);
  });

  it('returns a 25-year series with degradation', () => {
    const s = computeSavings({ kw: 4, monthlyUnits: 450, netCost: 129000 }, rules());
    expect(s.series.length).toBe(25);
    expect(s.series[24].savings).toBeLessThan(s.series[0].savings);
    expect(s.monthlyGeneration).toBe(504);
  });

  it('computes payback when cumulative savings pass the net cost', () => {
    const s = computeSavings({ kw: 4, monthlyUnits: 450, netCost: 129000 }, rules());
    expect(s.paybackYears).toBeGreaterThan(3);
    expect(s.paybackYears).toBeLessThan(4);
    const y = Math.ceil(/** @type {number} */ (s.paybackYears));
    expect(s.series[y - 1].netPosition).toBeGreaterThanOrEqual(0);
  });

  it('has no payback when savings never cover the cost', () => {
    expect(computeSavings({ kw: 1, monthlyUnits: 100, netCost: 5_000_000 }, rules()).paybackYears).toBeNull();
  });
});
