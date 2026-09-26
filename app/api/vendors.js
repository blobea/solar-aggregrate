// @ts-check
import { table, doc, delay, clone } from './store.js';
import { vendorMetrics, visibleReviews, latestSheet } from './metrics.js';
import { catalogueItem, itemLabel } from './catalogue.js';

/** Public vendor profile: details + objective metrics. No price sheet. @param {string} id */
export async function getVendorProfile(id) {
  await delay();
  const v = /** @type {any} */ (table('vendors').all().find((/** @type {any} */ x) => x.id === id));
  if (!v) return null;
  const m = vendorMetrics()[id];
  const sheet = latestSheet(id);
  const reviews = visibleReviews(id);
  const disputes = reviews.filter((r) => r.dispute).length;
  const replied = reviews.filter((r) => r.reply).length;
  return clone({
    ...v,
    metrics: {
      ...m,
      reviewCount: reviews.length,
      replyRate: reviews.length ? Math.round((replied / reviews.length) * 100) : null,
      disputes,
      resolvedByVendor: reviews.filter((r) => r.resolvedByVendor).length,
    },
    public: sheet ? {
      servicePincodes: sheet.servicePincodes,
      kwRange: sheet.kwRange,
      tiers: [...new Set(sheet.packages.map((p) => p.tier))],
      brands: [...new Set(sheet.packages.flatMap((p) => [p.panelId, p.inverterId]).map((x) => itemLabel(catalogueItem(x))))],
      workmanshipWarrantyYears: sheet.terms.workmanshipWarrantyYears,
      paymentMilestones: sheet.terms.paymentMilestones,
    } : null,
  });
}

/** Minimal list for pickers (role switcher). */
export async function listVendorNames() {
  await delay(0);
  return /** @type {any[]} */ (table('vendors').all()).map((v) => ({ id: v.id, name: v.name, vetting: v.vetting }));
}

/** Ops console: vendors with vetting, freshness, accuracy, rating. */
export async function listVendorsOps() {
  await delay();
  const m = vendorMetrics();
  return clone(/** @type {any[]} */ (table('vendors').all()).map((v) => ({ ...v, metrics: m[v.id] })));
}

/** Ops. @param {string} id @param {'approved'|'pending'|'suspended'} vetting */
export async function setVetting(id, vetting) {
  await delay();
  return clone(table('vendors').update(id, (v) => ({ ...v, vetting })));
}

/** Vendor dashboard metrics. @param {string} id */
export async function getVendorDashboard(id) {
  await delay();
  const m = vendorMetrics()[id];
  const leads = /** @type {any[]} */ (table('leads').all()).filter((l) => l.vendorId === id);
  const reviews = /** @type {any[]} */ (table('reviews').all()).filter((r) => r.vendorId === id);
  return clone({
    vendor: table('vendors').all().find((/** @type {any} */ v) => v.id === id),
    metrics: m,
    newLeads: leads.filter((l) => l.status === 'sent').length,
    activeLeads: leads.filter((l) => l.status !== 'installed').length,
    installed: leads.filter((l) => l.status === 'installed').length,
    awaitingReply: reviews.filter((r) => !r.reply && !r.dispute).length,
    openDisputes: reviews.filter((r) => r.dispute?.outcome === 'open').length,
  });
}

export async function getSettings() {
  await delay(0);
  return clone(doc.get('settings') || { sponsorEnabled: true });
}

/** @param {Record<string, any>} patch */
export async function updateSettings(patch) {
  await delay(0);
  const next = { ...(doc.get('settings') || {}), ...patch };
  doc.set('settings', next);
  return clone(next);
}
