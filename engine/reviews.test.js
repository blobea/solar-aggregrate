// @ts-check
import { describe, it, expect } from 'vitest';
import {
  validateReview, reviewScore, bayesianRating, effectiveStatus, isCountable, recencyWeight,
  raiseDispute, resolveDispute, cityMean,
} from './reviews.js';

const NOW = new Date('2026-09-26T10:00:00Z');

/** @param {Partial<import('./reviews.js').Review>} o @returns {import('./reviews.js').Review} */
const rev = (o) => ({
  id: 'r', vendorId: 'v1', customerName: 'A', milestone: 'survey',
  scores: { quoteAccuracy: 4, timeliness: 4, communication: 4 },
  createdAt: '2026-09-01T00:00:00Z', status: 'published', ...o,
});

describe('review validation', () => {
  it('requires every relevant dimension', () => {
    expect(validateReview({ milestone: 'survey', scores: { quoteAccuracy: 4 } }).length).toBe(2);
  });
  it('requires a reason code for any score ≤ 2', () => {
    const r = { milestone: /** @type {const} */ ('survey'), scores: { quoteAccuracy: 2, timeliness: 4, communication: 4 } };
    expect(validateReview(r).join()).toMatch(/reason/);
    expect(validateReview({ ...r, reasons: { quoteAccuracy: 'price_above_estimate' } })).toEqual([]);
  });
  it('rejects unknown reason codes', () => {
    const r = { milestone: /** @type {const} */ ('survey'), scores: { quoteAccuracy: 1, timeliness: 4, communication: 4 }, reasons: { quoteAccuracy: 'bogus' } };
    expect(validateReview(r).length).toBe(1);
  });
  it('requires evidence for install and a reading for long-term', () => {
    const install = { milestone: /** @type {const} */ ('install'), scores: { quoteAccuracy: 4, timeliness: 4, workmanship: 4, paperwork: 4, communication: 4 } };
    expect(validateReview(install).join()).toMatch(/evidence/);
    expect(validateReview({ ...install, evidence: 'INV-1' })).toEqual([]);
    const lt = { milestone: /** @type {const} */ ('longterm'), scores: { workmanship: 4, afterSales: 4, communication: 4 } };
    expect(validateReview(lt).join()).toMatch(/reading/);
  });
});

describe('review scoring', () => {
  it('excludes dimensions with external reason codes from the vendor score', () => {
    const r = rev({ scores: { quoteAccuracy: 5, timeliness: 1, communication: 5 }, reasons: { timeliness: 'discom_delay' } });
    expect(reviewScore(r)).toBe(5);
    const internal = rev({ scores: { quoteAccuracy: 5, timeliness: 1, communication: 5 }, reasons: { timeliness: 'missed_date' } });
    expect(reviewScore(internal)).toBeCloseTo(11 / 3);
  });
  it('returns null when every dimension is external', () => {
    const r = rev({ scores: { quoteAccuracy: 1, timeliness: 1, communication: 1 }, reasons: { quoteAccuracy: 'subsidy_portal_delay', timeliness: 'discom_delay', communication: 'discom_delay' } });
    expect(reviewScore(r)).toBeNull();
  });
  it('halves weight every 12 months', () => {
    expect(recencyWeight(0)).toBe(1);
    expect(recencyWeight(365)).toBeCloseTo(0.5);
    expect(recencyWeight(730)).toBeCloseTo(0.25);
  });
});

describe('bayesian rating', () => {
  it('returns the city mean with no reviews', () => {
    expect(bayesianRating([], { m: 4.1, now: NOW }).rating).toBe(4.1);
  });
  it('shrinks a single 5-star review toward the mean', () => {
    const r = bayesianRating([rev({ scores: { quoteAccuracy: 5, timeliness: 5, communication: 5 }, createdAt: NOW.toISOString() })], { m: 4, now: NOW });
    expect(r.rating).toBeCloseTo((5 * 4 + 5) / 6, 2);
  });
  it('weights install reviews 1.5× survey reviews', () => {
    const inst = rev({ milestone: 'install', scores: { quoteAccuracy: 1, timeliness: 1, workmanship: 1, paperwork: 1, communication: 1 }, reasons: { quoteAccuracy: 'other', timeliness: 'other', workmanship: 'other', paperwork: 'other', communication: 'other' }, createdAt: NOW.toISOString() });
    const r = bayesianRating([inst], { m: 4, now: NOW });
    expect(r.rating).toBeCloseTo((5 * 4 + 1.5 * 1) / 6.5, 2);
  });
  it('ignores pending, removed reviews; counts disputed-but-standing ones', () => {
    const fresh = rev({ status: 'pending_check', createdAt: '2026-09-25T10:00:00Z' });
    const removed = rev({ dispute: { ground: 'abusive', raisedAt: '', outcome: 'removed' } });
    const stands = rev({ dispute: { ground: 'factually_false', raisedAt: '', outcome: 'stands' } });
    const open = rev({ dispute: { ground: 'factually_false', raisedAt: '', outcome: 'open' } });
    expect(bayesianRating([fresh, removed, stands, open], { m: 4, now: NOW }).count).toBe(2);
  });
  it('city mean averages countable review scores', () => {
    expect(cityMean([rev({}), rev({ scores: { quoteAccuracy: 2, timeliness: 2, communication: 2 } })], NOW)).toBe(3);
  });
});

describe('review lifecycle', () => {
  it('publishes after 72 hours regardless of score', () => {
    const pos = rev({ status: 'pending_check', createdAt: '2026-09-23T09:00:00Z' });
    const neg = rev({ status: 'pending_check', createdAt: '2026-09-23T09:00:00Z', scores: { quoteAccuracy: 1, timeliness: 1, communication: 1 } });
    expect(effectiveStatus(pos, NOW)).toBe('published');
    expect(effectiveStatus(neg, NOW)).toBe('published');
    expect(effectiveStatus(rev({ status: 'pending_check', createdAt: '2026-09-24T12:00:00Z' }), NOW)).toBe('pending_check');
  });
  it('disputes do not hide a review until Ops removes it', () => {
    const d = raiseDispute(rev({}), 'factually_false', 'We quoted in writing', NOW);
    expect(isCountable(d, NOW)).toBe(true);
    const removed = resolveDispute(d, 'removed', 'Not a customer', NOW);
    expect(isCountable(removed, NOW)).toBe(false);
    const annotated = resolveDispute(d, 'annotated', 'Vendor context added', NOW);
    expect(isCountable(annotated, NOW)).toBe(true);
  });
  it('rejects unknown dispute grounds and double disputes', () => {
    expect(() => raiseDispute(rev({}), 'i_dont_like_it', '', NOW)).toThrow();
    const d = raiseDispute(rev({}), 'abusive', '', NOW);
    expect(() => raiseDispute(d, 'abusive', '', NOW)).toThrow();
  });
});
