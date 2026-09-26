// @ts-check
import { describe, it, expect } from 'vitest';
import { computeSubsidy } from './subsidy.js';
import { rules } from './fixtures.test-helper.js';

const R = rules();

describe('subsidy', () => {
  it('pays ₹30,000/kW for the first 2 kW', () => {
    expect(computeSubsidy({ kw: 1, dcr: true }, R).amount).toBe(30000);
    expect(computeSubsidy({ kw: 2, dcr: true }, R).amount).toBe(60000);
  });

  it('adds ₹18,000 for the 3rd kW, pro-rata', () => {
    expect(computeSubsidy({ kw: 2.5, dcr: true }, R).amount).toBe(69000);
    expect(computeSubsidy({ kw: 3, dcr: true }, R).amount).toBe(78000);
  });

  it('caps at ₹78,000 for larger systems', () => {
    expect(computeSubsidy({ kw: 5, dcr: true }, R).amount).toBe(78000);
    expect(computeSubsidy({ kw: 10, dcr: true }, R).amount).toBe(78000);
  });

  it('requires DCR panels', () => {
    const s = computeSubsidy({ kw: 3, dcr: false }, R);
    expect(s.amount).toBe(0);
    expect(s.reason).toMatch(/DCR/);
  });

  it('is residential only and only when requested', () => {
    expect(computeSubsidy({ kw: 3, dcr: true, residential: false }, R).amount).toBe(0);
    expect(computeSubsidy({ kw: 3, dcr: true, requested: false }, R).amount).toBe(0);
  });
});
