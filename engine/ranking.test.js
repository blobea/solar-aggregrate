// @ts-check
import { describe, it, expect } from 'vitest';
import { rankVendors, scoreItems, pickSponsored, freshnessScore, RANKING_WEIGHTS } from './ranking.js';

/** @param {Partial<import('./ranking.js').RankItem>} o @returns {import('./ranking.js').RankItem} */
const item = (o) => ({ vendorId: 'x', net: 150000, rating: 4, accuracyDeviation: 0.1, updatedDaysAgo: 5, stale: false, ...o });

const items = [
  item({ vendorId: 'cheap', net: 120000, rating: 3.4, accuracyDeviation: 0.28 }),
  item({ vendorId: 'premium', net: 170000, rating: 4.7, accuracyDeviation: 0.04 }),
  item({ vendorId: 'mid', net: 140000, rating: 4.1, accuracyDeviation: 0.08, sponsored: true }),
  item({ vendorId: 'stale', net: 125000, rating: 4.2, accuracyDeviation: 0.1, stale: true, updatedDaysAgo: 150, sponsored: true }),
  item({ vendorId: 'new', net: 145000, rating: 4.0, accuracyDeviation: null }),
];

describe('ranking', () => {
  it('weights sum to 1', () => {
    expect(Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('sorts by price ascending', () => {
    const ids = rankVendors(items, { sort: 'price' }).organic.map((i) => i.vendorId);
    expect(ids.slice(0, 4)).toEqual(['cheap', 'mid', 'new', 'premium']);
  });

  it('sorts by rating and by accuracy', () => {
    expect(rankVendors(items, { sort: 'rating' }).organic[0].vendorId).toBe('premium');
    expect(rankVendors(items, { sort: 'accuracy' }).organic[0].vendorId).toBe('premium');
  });

  it('ranks stale sheets last but does not hide them', () => {
    for (const sort of /** @type {const} */ (['best', 'price', 'rating', 'accuracy'])) {
      const { organic } = rankVendors(items, { sort });
      expect(organic.length).toBe(items.length);
      expect(organic[organic.length - 1].vendorId).toBe('stale');
    }
  });

  it('gives new vendors a neutral accuracy score', () => {
    const s = scoreItems(items).find((i) => i.vendorId === 'new');
    expect(s?.parts.accuracy).toBe(0.5);
  });

  it('sponsored slot never changes the organic order', () => {
    const on = rankVendors(items, { sponsorEnabled: true });
    const off = rankVendors(items, { sponsorEnabled: false });
    expect(on.organic.map((i) => i.vendorId)).toEqual(off.organic.map((i) => i.vendorId));
    expect(on.sponsored?.vendorId).toBe('mid');
    expect(off.sponsored).toBeNull();
    expect(on.organic.some((i) => i.vendorId === 'mid')).toBe(true);
  });

  it('sponsored requires a fresh sheet and rating ≥ 3.5', () => {
    expect(pickSponsored([items[3]])).toBeNull(); // stale
    expect(pickSponsored([item({ vendorId: 'low', rating: 3.2, sponsored: true })])).toBeNull();
    expect(pickSponsored([item({ vendorId: 'ok', rating: 3.5, sponsored: true })])?.vendorId).toBe('ok');
  });

  it('freshness decays with sheet age', () => {
    expect(freshnessScore(item({ updatedDaysAgo: 10 }))).toBe(1);
    expect(freshnessScore(item({ updatedDaysAgo: 75 }))).toBeCloseTo(0.5);
    expect(freshnessScore(item({ stale: true }))).toBe(0);
  });
});
