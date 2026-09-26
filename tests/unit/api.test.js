// @ts-check
/** Smoke test of the mock API end to end (runs on the in-memory storage fallback). */
import { describe, it, expect, beforeAll } from 'vitest';
import { auth, estimates, requests, reviews, vendors, sheets, demo, initApi } from '../../app/api/index.js';

describe('mock API', () => {
  beforeAll(async () => {
    initApi();
    await demo.resetDemo();
  });

  it('seeds leads for vendors from seed requests', async () => {
    const leads = await requests.listLeads('v-greengrid');
    expect(leads.length).toBeGreaterThanOrEqual(2);
    expect(leads[0].estimate.net).toBeGreaterThan(0);
  });

  it('runs the demo path: estimates → request → quote → install → review → dispute → resolve', async () => {
    await demo.signInDemoCustomer();
    const res = await estimates.getEstimates(/** @type {any} */ (demo.DEMO_CONFIG));
    expect(res.organic.length).toBeGreaterThanOrEqual(5);
    expect(res.sponsored?.vendorId).toBe('v-greengrid');
    // customer never receives a sheet
    expect(JSON.stringify(res)).not.toContain('ratesPerKw');
    const picks = res.organic.slice(0, 3);
    const noConsent = await requests.createRequests({ logIds: picks.map((c) => c.logId), consent: false, name: 'A', address: 'B' });
    expect(noConsent.ok).toBe(false);
    const created = await requests.createRequests({ logIds: picks.map((c) => c.logId), consent: true, name: 'Asha', address: 'HSR' });
    expect(created.ok).toBe(true);
    const lead = /** @type {any} */ (created.leads)[0];
    const before = (await vendors.getVendorProfile(lead.vendorId))?.metrics;
    await requests.logFinalQuote(lead.id, Math.round(lead.estimate.net * 1.35));
    await requests.advanceLead(lead.id); // → installed
    const mine = await requests.listMyRequests();
    const l = mine.find((x) => x.id === lead.id);
    expect(l.status).toBe('installed');
    expect(requests.reviewPrompts(l)).toContain('install');
    const bad = await reviews.submitReview({ leadId: lead.id, milestone: 'install', scores: { quoteAccuracy: 1, timeliness: 4, workmanship: 4, paperwork: 4, communication: 4 }, evidence: 'INV-1' });
    expect(bad.ok).toBe(false);
    const low = { quoteAccuracy: 1, timeliness: 2, workmanship: 2, paperwork: 2, communication: 1 };
    const why = { quoteAccuracy: 'price_above_estimate', timeliness: 'missed_date', workmanship: 'poor_workmanship', paperwork: 'paperwork_issue', communication: 'no_response' };
    const ok = await reviews.submitReview({ leadId: lead.id, milestone: 'install', scores: low, reasons: why, evidence: 'INV-1' });
    expect(ok.ok).toBe(true);
    await demo.advanceTime(4);
    const rid = /** @type {any} */ (ok.review).id;
    await reviews.disputeReview(rid, 'factually_false', 'Customer upgraded');
    await reviews.resolveDispute(rid, 'stands', 'Evidence supports the customer');
    const after = (await vendors.getVendorProfile(lead.vendorId))?.metrics;
    expect(after?.accuracy.count).toBe((before?.accuracy.count ?? 0) + 1);
    expect(after?.rating).toBeLessThan(/** @type {number} */ (before?.rating));
  });

  it('logs estimates append-only', async () => {
    const log = await estimates.listEstimatesLog();
    expect(log.length).toBeGreaterThan(5);
  });

  it('validates sheets and flags outliers', async () => {
    const s = await sheets.getPriceSheet('v-nimbus');
    s.packages[0].ratesPerKw['1-3'] = 5;
    const r = await sheets.savePriceSheet('v-nimbus', s);
    expect(r.ok).toBe(false);
    expect(r.errors[0].field).toBe('rate_1-3');
    s.packages[0].ratesPerKw['1-3'] = 120000;
    const r2 = await sheets.savePriceSheet('v-nimbus', s);
    expect(r2.ok).toBe(true);
    expect(r2.flags.some((f) => f.slab === '1-3')).toBe(true);
    expect(r2.sheet.version).toBe(2);
  });

  it('rejects a wrong OTP', async () => {
    expect((await auth.verifyOtp('9876543210', '000000')).ok).toBe(false);
  });
});
