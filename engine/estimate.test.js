// @ts-check
import { describe, it, expect } from 'vitest';
import { estimate, slabFor, isStale, checkEligibility, pickPackage, distanceKm, daysSince } from './estimate.js';
import { rules, sheet, config, catalogue, vendor, NOW } from './fixtures.test-helper.js';

const run = (cfg = config(), sh = sheet(), now = NOW) => estimate({ config: cfg, sheet: sh, rules: rules(), vendor, catalogue, now });

describe('slab selection', () => {
  it('puts boundaries in the lower slab (first slab closed)', () => {
    expect(slabFor(1)).toBe('1-3');
    expect(slabFor(3)).toBe('1-3');
    expect(slabFor(3.5)).toBe('3-5');
    expect(slabFor(5)).toBe('3-5');
    expect(slabFor(5.5)).toBe('5-10');
    expect(slabFor(10)).toBe('5-10');
    expect(slabFor(10.5)).toBe('10-25');
    expect(slabFor(25)).toBe('10-25');
  });
  it('returns null outside all slabs', () => {
    expect(slabFor(0.5)).toBeNull();
    expect(slabFor(30)).toBeNull();
  });
});

describe('estimate', () => {
  it('computes an all-in gross, platform subsidy and net for the reference home', () => {
    const e = run();
    expect(e.eligible).toBe(true);
    expect(e.kw).toBe(4);
    expect(e.packageId).toBe('p-std-dcr');
    // 4×46,000 + 4×3,000 structure + 11,000 fixed
    expect(e.gross).toBe(207000);
    expect(e.subsidy).toBe(78000);
    expect(e.net).toBe(129000);
    expect(e.low).toBe(116000);
    expect(e.high).toBe(142000);
  });

  it('always includes fixed charges as line items', () => {
    const codes = (run().lineItems || []).map((l) => l.code);
    expect(codes).toEqual(expect.arrayContaining(['system', 'structure', 'net_meter', 'paperwork', 'transport']));
  });

  it('line items sum to gross', () => {
    const e = run(config({}, { evCharger: 7.4, battery: 5 }));
    expect((e.lineItems || []).reduce((s, l) => s + l.amount, 0)).toBe(e.gross);
  });

  it('uses the DCR package when subsidy is on and the cheaper non-DCR one when off', () => {
    expect(run().packageId).toBe('p-std-dcr');
    const off = run(config({}, { subsidy: false }));
    expect(off.packageId).toBe('p-std-ndcr');
    expect(off.subsidy).toBe(0);
    expect(off.net).toBe(off.gross);
  });

  it('is ineligible for subsidy when the vendor has no DCR package in the tier', () => {
    const sh = sheet({ packages: sheet().packages.filter((p) => !p.dcr) });
    const e = run(config(), sh);
    expect(e.eligible).toBe(false);
    expect(e.reasons.join()).toMatch(/DCR/);
  });

  it('adds floor and distance charges', () => {
    const far = run(config({ pincode: '560064', floors: 4 }), sheet({ servicePincodes: ['560064'] }));
    const codes = (far.lineItems || []).map((l) => l.code);
    expect(codes).toContain('floors');
    expect(codes).toContain('distance');
    expect(far.lineItems?.find((l) => l.code === 'floors')?.amount).toBe(5000);
  });

  it('adds EV charger and battery add-ons and prefers hybrid inverters with a battery', () => {
    const e = run(config({}, { battery: 5, evCharger: 7.4 }));
    expect(e.packageId).toBe('p-std-hyb');
    expect(e.lineItems?.find((l) => l.code === 'ev')?.amount).toBe(55000);
    expect(e.lineItems?.find((l) => l.code === 'battery')?.amount).toBe(150000);
  });

  it('respects a user kW override within limits', () => {
    expect(run(config({ kw: 3 })).kw).toBe(3);
    expect(run(config({ kw: 20 })).kw).toBe(5); // clamped to sanctioned load
  });

  it('uses the vendor tolerance for the range', () => {
    const sh = sheet();
    sh.terms.tolerancePct = 5;
    const e = run(config(), sh);
    expect(e.low).toBe(123000);
    expect(e.high).toBe(135000);
  });
});

describe('stale sheets', () => {
  it('marks a sheet stale after validUntil and warns, but still estimates', () => {
    const sh = sheet();
    sh.terms.validUntil = '2026-09-01';
    const e = run(config(), sh);
    expect(e.eligible).toBe(true);
    expect(e.stale).toBe(true);
    expect(e.warnings?.join()).toMatch(/outdated/);
  });
  it('is fresh through the end of the validUntil day', () => {
    expect(isStale('2026-09-26', NOW)).toBe(false);
    expect(isStale('2026-09-25', NOW)).toBe(true);
  });
  it('counts days since update', () => {
    expect(daysSince('2026-09-16', NOW)).toBe(10);
  });
});

describe('eligibility', () => {
  it('rejects pincodes the vendor does not serve', () => {
    const r = checkEligibility({ config: config({ pincode: '560064' }), sheet: sheet(), kw: 4, catalogue });
    expect(r.eligible).toBe(false);
    expect(r.reasons[0]).toMatch(/pincode/);
  });
  it('rejects sizes outside the vendor kW range', () => {
    const r = checkEligibility({ config: config(), sheet: sheet({ kwRange: [5, 25] }), kw: 4, catalogue });
    expect(r.eligible).toBe(false);
  });
  it('rejects when no package in the tier exists', () => {
    const r = checkEligibility({ config: config({}, { tier: 'premium' }), sheet: sheet(), kw: 4, catalogue });
    expect(r.eligible).toBe(false);
  });
  it('skips packages whose equipment is unavailable', () => {
    const sh = sheet();
    sh.availability.pn1 = { status: 'unavailable', leadTimeDays: 0 };
    const { pkg } = pickPackage(sh, config({}, { subsidy: false }), 4, catalogue);
    expect(pkg?.id).toBe('p-std-ndcr');
    expect(pickPackage(sh, config(), 4, catalogue).pkg).toBeNull();
  });
  it('estimates distances between known pincodes and 0 for unknown', () => {
    expect(distanceKm('560034', '560102', rules())).toBeGreaterThan(2);
    expect(distanceKm('560034', '999999', rules())).toBe(0);
  });
});
