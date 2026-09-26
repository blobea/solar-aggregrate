// @ts-check
/**
 * Vendor price sheets. Only the vendor portal and Ops console call these; the customer UI never does.
 * Every save creates a new version; old versions are kept.
 */
import { table, delay, clone, nowIso, now } from './store.js';
import { catalogueSync, rulesSync } from './catalogue.js';
import { latestSheet, latestSheets } from './metrics.js';
import { SLABS } from '../../engine/estimate.js';
import { median } from '../../engine/accuracy.js';

export const TIERS = ['economy', 'standard', 'premium'];
export const ROOF_TYPES = ['rcc', 'sheet', 'tile'];
export const STRUCTURES = ['standard', 'elevated_6ft', 'elevated_10ft'];
export const SANITY_THRESHOLD = 0.3;

/**
 * @typedef {{section:string, row:number|null, field:string, message:string}} SheetError
 */

/**
 * Validate a price sheet. Errors carry section/row/field so the UI can highlight the exact cell.
 * @param {any} s @returns {SheetError[]}
 */
export function validateSheet(s) {
  /** @type {SheetError[]} */
  const errs = [];
  const err = (/** @type {string} */ section, /** @type {number|null} */ row, /** @type {string} */ field, /** @type {string} */ message) => errs.push({ section, row, field, message });
  const num = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v);
  const cat = catalogueSync();
  const panels = Object.fromEntries(cat.panels.map((/** @type {any} */ p) => [p.id, p]));
  const inverters = new Set(cat.inverters.map((/** @type {any} */ i) => i.id));

  if (!Array.isArray(s.packages) || !s.packages.length) err('packages', null, 'packages', 'At least one package is required');
  const ids = new Set();
  (s.packages || []).forEach((/** @type {any} */ p, /** @type {number} */ i) => {
    if (!p.id || typeof p.id !== 'string') err('packages', i, 'id', 'Package id is required');
    else if (ids.has(p.id)) err('packages', i, 'id', 'Duplicate package id');
    ids.add(p.id);
    if (!p.name) err('packages', i, 'name', 'Name is required');
    if (!TIERS.includes(p.tier)) err('packages', i, 'tier', 'Tier must be economy, standard or premium');
    if (!panels[p.panelId]) err('packages', i, 'panelId', 'Unknown panel');
    else if (p.dcr && !panels[p.panelId].dcr) err('packages', i, 'dcr', 'Package marked DCR but panel is not DCR');
    if (!inverters.has(p.inverterId)) err('packages', i, 'inverterId', 'Unknown inverter');
    for (const slab of SLABS) {
      const v = p.ratesPerKw?.[slab];
      if (!num(v) || v < 20000 || v > 150000) err('packages', i, `rate_${slab}`, `₹/kW for ${slab} kW must be 20,000–1,50,000`);
    }
  });
  for (const rt of ROOF_TYPES) for (const st of STRUCTURES) {
    const v = s.structure?.[rt]?.[st];
    if (!num(v) || v < 0 || v > 30000) err('structure', ROOF_TYPES.indexOf(rt), st, `${rt.toUpperCase()} ${st}: ₹0–30,000 per kW`);
  }
  for (const f of ['perFloorAbove2', 'freeRadiusKm', 'perKmBeyond']) if (!num(s.site?.[f]) || s.site[f] < 0) err('site', 0, f, 'Must be 0 or more');
  for (const f of ['netMeterFee', 'paperwork', 'transport']) if (!num(s.fixed?.[f]) || s.fixed[f] < 0 || s.fixed[f] > 50000) err('fixed', 0, f, 'Must be ₹0–50,000');
  if (!num(s.addOns?.batteryPerKwh) || s.addOns.batteryPerKwh < 0) err('addOns', 0, 'batteryPerKwh', 'Must be 0 or more');
  for (const f of ['monitoring', 'amcPerYear']) if (!num(s.addOns?.[f]) || s.addOns[f] < 0) err('addOns', 0, f, 'Must be 0 or more');
  for (const [k, v] of Object.entries(s.addOns?.evCharger || {})) if (!num(v) || v < 0) err('addOns', 0, `ev_${k}`, 'EV charger price must be 0 or more');
  const t = s.terms || {};
  if (!t.validUntil || Number.isNaN(Date.parse(t.validUntil))) err('terms', 0, 'validUntil', 'Enter a valid date');
  if (!num(t.tolerancePct) || t.tolerancePct < 0 || t.tolerancePct > 30) err('terms', 0, 'tolerancePct', 'Tolerance must be 0–30%');
  if (!num(t.workmanshipWarrantyYears) || t.workmanshipWarrantyYears < 1 || t.workmanshipWarrantyYears > 25) err('terms', 0, 'workmanshipWarrantyYears', 'Warranty must be 1–25 years');
  const [min, max] = s.kwRange || [];
  if (!num(min) || !num(max) || min < 1 || max > 25 || min >= max) err('terms', 0, 'kwRange', 'kW range must be within 1–25 with min < max');
  const known = new Set(rulesSync().pincodes.map((p) => p.pincode));
  const bad = (s.servicePincodes || []).filter((/** @type {string} */ p) => !known.has(p));
  if (bad.length) err('terms', 0, 'servicePincodes', `Unknown pincodes: ${bad.join(', ')}`);
  if (!(s.servicePincodes || []).length) err('terms', 0, 'servicePincodes', 'Serve at least one pincode');
  return errs;
}

/**
 * Flag ₹/kW rates more than 30% away from the city median for the same slab and tier
 * (median across other vendors' latest sheets).
 * @param {any} sheet
 */
export function sanityCheck(sheet) {
  const others = Object.values(latestSheets()).filter((s) => s.vendorId !== sheet.vendorId);
  /** @type {{packageId:string, packageIndex:number, tier:string, slab:string, rate:number, median:number, deviationPct:number}[]} */
  const flags = [];
  (sheet.packages || []).forEach((/** @type {any} */ p, /** @type {number} */ i) => {
    for (const slab of SLABS) {
      const peers = others.flatMap((s) => s.packages.filter((q) => q.tier === p.tier).map((q) => q.ratesPerKw[slab])).filter((x) => x > 0);
      if (!peers.length) continue;
      const med = median(peers);
      const rate = p.ratesPerKw?.[slab];
      const dev = (rate - med) / med;
      if (Math.abs(dev) > SANITY_THRESHOLD) flags.push({ packageId: p.id, packageIndex: i, tier: p.tier, slab, rate, median: Math.round(med), deviationPct: Math.round(dev * 100) });
    }
  });
  return flags;
}

/** @param {string} vendorId */
export async function getPriceSheet(vendorId) {
  await delay();
  return clone(latestSheet(vendorId));
}

/** @param {string} vendorId */
export async function listSheetVersions(vendorId) {
  await delay();
  return /** @type {any[]} */ (table('priceSheets').all()).filter((s) => s.vendorId === vendorId)
    .map((s) => ({ version: s.version, updatedAt: s.updatedAt, validUntil: s.terms.validUntil, savedBy: s.savedBy || 'seed' }))
    .sort((a, b) => b.version - a.version);
}

/**
 * Save a new version of a vendor's price sheet.
 * @param {string} vendorId @param {any} sheet @param {{savedBy?: string}} [opts]
 */
export async function savePriceSheet(vendorId, sheet, { savedBy = 'vendor' } = {}) {
  await delay();
  const errors = validateSheet(sheet);
  if (errors.length) return { ok: false, errors, flags: [] };
  const prev = latestSheet(vendorId);
  const next = { ...clone(sheet), vendorId, version: (prev?.version || 0) + 1, updatedAt: nowIso(), savedBy };
  table('priceSheets').insert(next);
  return { ok: true, errors: [], flags: sanityCheck(next), sheet: clone(next) };
}

/** Availability edits also create a new sheet version. @param {string} vendorId @param {Record<string, any>} availability */
export async function updateAvailability(vendorId, availability) {
  const cur = latestSheet(vendorId);
  if (!cur) throw new Error('No price sheet');
  return savePriceSheet(vendorId, { ...cur, availability }, { savedBy: 'vendor (availability)' });
}

/** Days until the sheet expires (negative = expired). @param {any} sheet */
export function daysToExpiry(sheet) {
  return Math.floor((new Date(sheet.terms.validUntil).getTime() - now()) / 86_400_000);
}
