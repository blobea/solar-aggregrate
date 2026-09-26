// @ts-check
import { describe, it, expect } from 'vitest';
import { recommendKw, clampKw, roundUpToHalf, roundDownToHalf, energyCharge, billToUnits, monthlyGeneration } from './sizing.js';
import { rules } from './fixtures.test-helper.js';

describe('sizing', () => {
  it('rounds to half kW in the right direction', () => {
    expect(roundUpToHalf(3.01)).toBe(3.5);
    expect(roundUpToHalf(3.5)).toBe(3.5);
    expect(roundDownToHalf(9.23)).toBe(9);
    expect(roundDownToHalf(9.5)).toBe(9.5);
  });

  it('sizes by usage when roof and load allow (450 units → 4 kW)', () => {
    const r = recommendKw({ monthlyUnits: 450, roofAreaSqm: 60, sanctionedLoadKw: 5 }, rules());
    expect(r.byUsage).toBe(4);
    expect(r.byRoof).toBe(9);
    expect(r.recommendedKw).toBe(4);
    expect(r.limitingFactor).toBe('usage');
  });

  it('is limited by roof area', () => {
    const r = recommendKw({ monthlyUnits: 900, roofAreaSqm: 20, sanctionedLoadKw: 10 }, rules());
    expect(r.recommendedKw).toBe(3); // 20/6.5 = 3.07 → 3
    expect(r.limitingFactor).toBe('roof');
  });

  it('is limited by sanctioned load', () => {
    const r = recommendKw({ monthlyUnits: 900, roofAreaSqm: 100, sanctionedLoadKw: 3 }, rules());
    expect(r.recommendedKw).toBe(3);
    expect(r.limitingFactor).toBe('sanctioned');
  });

  it('never goes below the 1 kW minimum and warns', () => {
    const r = recommendKw({ monthlyUnits: 50, roofAreaSqm: 4, sanctionedLoadKw: 2 }, rules());
    expect(r.recommendedKw).toBe(1);
    expect(r.warnings.length).toBe(1);
  });

  it('clamps overrides to limits and snaps to 0.5', () => {
    const lim = { minKw: 1, maxKw: 5 };
    expect(clampKw(7, lim)).toBe(5);
    expect(clampKw(0.2, lim)).toBe(1);
    expect(clampKw(3.3, lim)).toBe(3.5);
  });

  it('computes monthly generation from yield', () => {
    expect(monthlyGeneration(4, rules())).toBeCloseTo(504);
  });

  it('applies tariff slabs progressively', () => {
    const { slabs } = rules().tariff;
    expect(energyCharge(200, slabs)).toBeCloseTo(1180);
    expect(energyCharge(450, slabs)).toBeCloseTo(1180 + 250 * 7.2);
    expect(energyCharge(600, slabs)).toBeCloseTo(1180 + 300 * 7.2 + 100 * 7.85);
  });

  it('converts a bill back to units (inverse of the tariff)', () => {
    const { slabs } = rules().tariff;
    expect(billToUnits(energyCharge(450, slabs), slabs)).toBe(450);
    expect(billToUnits(energyCharge(120, slabs), slabs)).toBe(120);
    expect(billToUnits(energyCharge(750, slabs), slabs)).toBe(750);
  });
});
