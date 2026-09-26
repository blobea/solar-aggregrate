// @ts-check
/**
 * Customer-facing estimates. Returns only computed estimates plus public vendor info —
 * never a vendor's price sheet. Every estimate shown is appended to the estimates log (never edited).
 */
import { table, doc, delay, clone, now, nowIso, newId, ensureSeeded } from './store.js';
import { rulesSync, catalogueSync, catalogueItem, itemLabel } from './catalogue.js';
import { latestSheets, vendorMetrics } from './metrics.js';
import { getSession, currentCustomer } from './auth.js';
import { estimate, resolveKw } from '../../engine/estimate.js';
import { recommendKw } from '../../engine/sizing.js';
import { computeSavings } from '../../engine/savings.js';
import { rankVendors } from '../../engine/ranking.js';
import { median } from '../../engine/accuracy.js';

/** Stable short hash of a configuration. @param {any} config */
export function configHash(config) {
  const s = JSON.stringify(config, Object.keys(flatKeys(config)).sort());
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/** @param {any} o @param {Record<string, true>} [acc] */
function flatKeys(o, acc = {}) {
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { acc[k] = true; flatKeys(o[k], acc); }
  return acc;
}

/**
 * Append to the estimates log unless an identical entry already exists. Never edits existing entries.
 * @param {any} entry
 */
function logEstimate(entry) {
  const log = table('estimatesLog');
  const dup = /** @type {any[]} */ (log.all()).find((e) => e.customerId === entry.customerId && e.configHash === entry.configHash
    && e.vendorId === entry.vendorId && e.sheetVersion === entry.sheetVersion && e.net === entry.net);
  if (dup) return dup.id;
  const row = { id: newId('est'), at: nowIso(), ...entry };
  log.insert(row);
  return row.id;
}

/** Public card for one vendor's estimate. */
function toCard(/** @type {any} */ vendor, /** @type {any} */ est, /** @type {any} */ sheet, /** @type {any} */ m) {
  const pkg = sheet.packages.find((/** @type {any} */ p) => p.id === est.packageId);
  const panel = catalogueItem(pkg.panelId);
  const inverter = catalogueItem(pkg.inverterId);
  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    tagline: vendor.tagline,
    estimate: clone(est),
    package: {
      name: pkg.name, tier: pkg.tier, dcr: pkg.dcr,
      panel: panel ? `${itemLabel(panel)} · ${panel.wp} Wp ${panel.technology}` : '—',
      panelWarrantyYears: panel?.warrantyYears ?? null,
      inverter: inverter ? `${itemLabel(inverter)} (${inverter.type})` : '—',
      inverterWarrantyYears: inverter?.warrantyYears ?? null,
    },
    workmanshipWarrantyYears: sheet.terms.workmanshipWarrantyYears,
    paymentMilestones: sheet.terms.paymentMilestones,
    amcPerYear: sheet.addOns.amcPerYear,
    rating: m.rating,
    ratingCount: m.ratingCount,
    accuracy: m.accuracy,
    updatedDaysAgo: m.updatedDaysAgo,
    stale: m.stale,
    sponsoredVendor: !!vendor.sponsored,
  };
}

/**
 * Compute, rank and log estimates for a configuration.
 * @param {import('../../engine/types.js').Config} config
 * @param {{sort?: 'best'|'price'|'rating'|'accuracy', tier?: string}} [opts]
 */
export async function getEstimates(config, { sort = 'best' } = {}) {
  ensureSeeded();
  await delay();
  const session = getSession();
  const customer = currentCustomer();
  return computeEstimates(config, sort, { customerId: session.customerId, name: customer?.name || null, phone: session.phone });
}

/**
 * Synchronous core of getEstimates (also used by seeding).
 * @param {import('../../engine/types.js').Config} config
 * @param {'best'|'price'|'rating'|'accuracy'} sort
 * @param {{customerId:string|null, name:string|null, phone:string|null}} who
 */
export function computeEstimates(config, sort, who) {
  const rules = rulesSync();
  const catalogue = catalogueSync();
  const t = now();
  const sheets = latestSheets();
  const metrics = vendorMetrics();
  const settings = doc.get('settings') || { sponsorEnabled: true };
  const hash = configHash(config);

  const cards = [];
  const ineligible = [];
  for (const v of /** @type {any[]} */ (table('vendors').all())) {
    if (v.vetting !== 'approved') continue;
    const sheet = sheets[v.id];
    if (!sheet) continue;
    const est = estimate({ config, sheet, rules, vendor: v, catalogue, now: t });
    if (!est.eligible) { ineligible.push({ vendorId: v.id, vendorName: v.name, reasons: est.reasons }); continue; }
    const card = toCard(v, est, sheet, metrics[v.id]);
    card.logId = logEstimate({
      customerId: who.customerId, customerName: who.name, phone: who.phone,
      configHash: hash, pincode: config.pincode, kw: est.kw, vendorId: v.id, vendorName: v.name,
      sheetVersion: sheet.version, packageId: est.packageId,
      packageName: card.package.name, gross: est.gross, subsidy: est.subsidy, net: est.net, low: est.low, high: est.high,
      lineItems: est.lineItems, config: clone(config),
    });
    cards.push(card);
  }

  const rankInput = cards.map((c) => ({
    vendorId: c.vendorId, net: /** @type {number} */ (c.estimate.net), rating: c.rating,
    accuracyDeviation: c.accuracy.medianDeviation, updatedDaysAgo: c.updatedDaysAgo ?? 999,
    stale: c.stale, sponsored: c.sponsoredVendor,
  }));
  const ranked = rankVendors(rankInput, { sort, sponsorEnabled: settings.sponsorEnabled });
  const byId = Object.fromEntries(cards.map((c) => [c.vendorId, c]));
  const organic = ranked.organic.map((r, i) => ({ ...byId[r.vendorId], score: r.score, parts: r.parts, position: i + 1 }));
  const sponsored = ranked.sponsored ? { ...byId[ranked.sponsored.vendorId], sponsoredSlot: true } : null;

  const sizing = recommendKw(config, rules);
  const kw = resolveKw(config, rules);
  const nets = cards.map((c) => /** @type {number} */ (c.estimate.net));
  const typicalNet = nets.length ? median(nets) : 0;
  const savings = computeSavings({ kw, monthlyUnits: config.monthlyUnits, netCost: typicalNet }, rules);
  return { kw, sizing, savings, typicalNet, organic, sponsored, ineligible, configHash: hash, at: new Date(t).toISOString() };
}

/** Quick sizing + savings preview for the configurator (no vendor data, not logged). @param {any} config */
export async function previewSizing(config) {
  await delay(0);
  const rules = rulesSync();
  const sizing = recommendKw(config, rules);
  const kw = resolveKw(config, rules);
  return { sizing, kw, monthlyGeneration: Math.round(kw * rules.yieldPerKwDay * 30) };
}

/** Ops: read-only estimates log, newest first. */
export async function listEstimatesLog() {
  await delay();
  return clone(/** @type {any[]} */ (table('estimatesLog').all()).slice().reverse());
}

/** @param {string} id */
export function logEntry(id) {
  return clone(/** @type {any[]} */ (table('estimatesLog').all()).find((e) => e.id === id) || null);
}
