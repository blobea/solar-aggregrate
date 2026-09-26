// @ts-check
import { describe, it, expect } from 'vitest';
import { deviation, median, accuracyBadge, vendorAccuracy } from './accuracy.js';

/** @param {number} final @param {number} i */
const q = (final, i, vendorId = 'v1') => ({ vendorId, estimateShown: 100000, finalQuote: final, date: `2026-0${1 + (i % 9)}-1${i % 10}` });

describe('accuracy', () => {
  it('computes absolute relative deviation', () => {
    expect(deviation(110000, 100000)).toBeCloseTo(0.1);
    expect(deviation(90000, 100000)).toBeCloseTo(0.1);
  });

  it('takes the median (odd and even counts)', () => {
    expect(median([0.3, 0.1, 0.2])).toBe(0.2);
    expect(median([0.1, 0.2, 0.3, 0.4])).toBeCloseTo(0.25);
  });

  it('badge thresholds: ≤10% green, ≤20% amber, else red', () => {
    expect(accuracyBadge(0.1, 5)).toBe('green');
    expect(accuracyBadge(0.1001, 5)).toBe('amber');
    expect(accuracyBadge(0.2, 5)).toBe('amber');
    expect(accuracyBadge(0.21, 5)).toBe('red');
  });

  it('fewer than 3 quotes is "New — not enough data"', () => {
    const a = vendorAccuracy([q(105000, 1), q(103000, 2)], 'v1');
    expect(a.badge).toBe('new');
    expect(a.label).toBe('New — not enough data');
  });

  it('labels the median deviation as a percentage', () => {
    const a = vendorAccuracy([q(105000, 1), q(108000, 2), q(92000, 3)], 'v1');
    expect(a.pct).toBe(8);
    expect(a.label).toBe('Quotes within ±8% of estimate');
    expect(a.badge).toBe('green');
  });

  it('uses only the most recent 20 quotes of that vendor', () => {
    const old = Array.from({ length: 10 }, (_, i) => ({ vendorId: 'v1', estimateShown: 100000, finalQuote: 150000, date: `2024-01-${10 + i}` }));
    const recent = Array.from({ length: 20 }, (_, i) => ({ vendorId: 'v1', estimateShown: 100000, finalQuote: 102000, date: `2026-05-${10 + i}` }));
    const other = [{ vendorId: 'v2', estimateShown: 100000, finalQuote: 200000, date: '2026-09-01' }];
    const a = vendorAccuracy([...old, ...recent, ...other], 'v1');
    expect(a.count).toBe(20);
    expect(a.pct).toBe(2);
  });
});
