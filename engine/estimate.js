// @ts-check
import { computeSubsidy } from './subsidy.js';
import { recommendKw, clampKw } from './sizing.js';

/** @typedef {import('./types.js').Config} Config */
/** @typedef {import('./types.js').PriceSheet} PriceSheet */
/** @typedef {import('./types.js').Package} Package */
/** @typedef {import('./types.js').CityRules} CityRules */
/** @typedef {import('./types.js').Estimate} Estimate */
/** @typedef {import('./types.js').LineItem} LineItem */

export const SLABS = ['1-3', '3-5', '5-10', '10-25'];
const ROAD_FACTOR = 1.3;
const DAY_MS = 86_400_000;

/**
 * Rate slab for a system size. First slab is closed [1,3]; later slabs are (min,max].
 * So 3 kW → "1-3", 3.5 kW → "3-5", 5 kW → "3-5", 10 kW → "5-10".
 * @param {number} kw
 * @returns {string|null}
 */
export function slabFor(kw) {
  for (let i = 0; i < SLABS.length; i++) {
    const [min, max] = SLABS[i].split('-').map(Number);
    const aboveMin = i === 0 ? kw >= min : kw > min;
    if (aboveMin && kw <= max) return SLABS[i];
  }
  return null;
}

/**
 * Approximate road distance between two pincodes (haversine × road factor), using the city pincode table.
 * @param {string} from @param {string} to @param {CityRules} rules
 */
export function distanceKm(from, to, rules) {
  const a = rules.pincodes.find((p) => p.pincode === from);
  const b = rules.pincodes.find((p) => p.pincode === to);
  if (!a || !b) return 0;
  const rad = (/** @type {number} */ d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR * 10) / 10;
}

/** @param {string} validUntil @param {Date|number} now */
export function isStale(validUntil, now) {
  const end = new Date(validUntil).getTime() + DAY_MS; // valid through the end of that day
  return new Date(now).getTime() > end;
}

/** @param {string} updatedAt @param {Date|number} now */
export function daysSince(updatedAt, now) {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(updatedAt).getTime()) / DAY_MS));
}

/**
 * Size to quote: the user's override (clamped) or the recommendation.
 * @param {Config} config @param {CityRules} rules
 */
export function resolveKw(config, rules) {
  const rec = recommendKw(config, rules);
  return config.kw ? clampKw(config.kw, rec) : rec.recommendedKw;
}

/**
 * Choose the vendor's best package for the customer's tier: matching tier, DCR when subsidy is on,
 * panel + inverter not unavailable, cheapest rate in the slab. Hybrid inverters preferred when a battery is asked for.
 * @param {PriceSheet} sheet @param {Config} config @param {number} kw
 * @param {{inverters?: {id:string, type:string}[]}} [catalogue]
 * @returns {{pkg: Package|null, reason: string|null}}
 */
export function pickPackage(sheet, config, kw, catalogue = {}) {
  const slab = slabFor(kw);
  if (!slab) return { pkg: null, reason: `No rate slab covers ${kw} kW` };
  const avail = (/** @type {string} */ id) => sheet.availability?.[id]?.status !== 'unavailable';
  let candidates = sheet.packages.filter((p) => p.tier === config.prefs.tier);
  if (!candidates.length) return { pkg: null, reason: `No ${config.prefs.tier} package` };
  if (config.prefs.subsidy) {
    candidates = candidates.filter((p) => p.dcr);
    if (!candidates.length) return { pkg: null, reason: 'No DCR package for subsidy' };
  }
  candidates = candidates.filter((p) => avail(p.panelId) && avail(p.inverterId) && p.ratesPerKw[slab] > 0);
  if (!candidates.length) return { pkg: null, reason: 'Matching package not available' };
  const hybrid = new Set((catalogue.inverters || []).filter((i) => i.type === 'hybrid').map((i) => i.id));
  if (config.prefs.battery > 0 && candidates.some((p) => hybrid.has(p.inverterId))) {
    candidates = candidates.filter((p) => hybrid.has(p.inverterId));
  }
  candidates.sort((a, b) => a.ratesPerKw[slab] - b.ratesPerKw[slab] || a.id.localeCompare(b.id));
  return { pkg: candidates[0], reason: null };
}

/**
 * Eligibility of one vendor for one configuration.
 * @param {{config:Config, sheet:PriceSheet, kw:number, catalogue?:any}} input
 */
export function checkEligibility({ config, sheet, kw, catalogue }) {
  /** @type {string[]} */
  const reasons = [];
  if (!sheet.servicePincodes.includes(config.pincode)) reasons.push('Does not serve this pincode');
  const [min, max] = sheet.kwRange;
  if (kw < min || kw > max) reasons.push(`Installs ${min}–${max} kW only`);
  const { pkg, reason } = pickPackage(sheet, config, kw, catalogue);
  if (!pkg && reason) reasons.push(reason);
  return { eligible: reasons.length === 0, reasons, pkg };
}

/** @param {number} n @param {number} step */
const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * All-in estimate for one vendor. Pure: pass `now` explicitly.
 * gross = rate(slab)×kW + structure×kW + floors + distance + fixed + add-ons; net = gross − platform subsidy.
 * @param {{config:Config, sheet:PriceSheet, rules:CityRules, vendor:{id:string, basePincode:string},
 *          catalogue?: any, now: Date|number}} input
 * @returns {Estimate}
 */
export function estimate({ config, sheet, rules, vendor, catalogue = {}, now }) {
  const kw = resolveKw(config, rules);
  const { eligible, reasons, pkg } = checkEligibility({ config, sheet, kw, catalogue });
  if (!eligible || !pkg) return { eligible: false, reasons, vendorId: vendor.id };

  const slab = /** @type {string} */ (slabFor(kw));
  /** @type {LineItem[]} */
  const items = [];
  const add = (/** @type {string} */ code, /** @type {string} */ label, /** @type {number} */ amount) => {
    if (amount) items.push({ code, label, amount: Math.round(amount) });
  };
  /** @type {string[]} */
  const warnings = [];

  add('system', `${pkg.name}: ${kw} kW × ₹${pkg.ratesPerKw[slab].toLocaleString('en-IN')}/kW (${slab} kW slab)`, pkg.ratesPerKw[slab] * kw);
  const structRate = sheet.structure?.[config.roofType]?.[config.structure] ?? 0;
  add('structure', `Mounting structure (${config.roofType.toUpperCase()}, ${config.structure.replace('_', ' ')})`, structRate * kw);
  const extraFloors = Math.max(0, config.floors - 2);
  add('floors', `Height charge: ${extraFloors} floor(s) above 2`, extraFloors * sheet.site.perFloorAbove2);
  const km = distanceKm(vendor.basePincode, config.pincode, rules);
  const extraKm = Math.max(0, km - sheet.site.freeRadiusKm);
  add('distance', `Travel: ${Math.round(extraKm)} km beyond ${sheet.site.freeRadiusKm} km free radius`, extraKm * sheet.site.perKmBeyond);
  add('net_meter', 'Net-meter & DISCOM fee', sheet.fixed.netMeterFee);
  add('paperwork', 'Paperwork & approvals', sheet.fixed.paperwork);
  add('transport', 'Transport & handling', sheet.fixed.transport);

  const { battery, evCharger } = config.prefs;
  if (battery > 0) {
    add('battery', `Battery storage ${battery} kWh`, battery * sheet.addOns.batteryPerKwh);
    const b = (catalogue.batteries || []).find((/** @type {any} */ x) => x.kwh === battery);
    if (b && sheet.availability?.[b.id]?.status === 'unavailable') warnings.push('Battery currently unavailable from this vendor');
  }
  if (evCharger > 0) {
    const price = sheet.addOns.evCharger?.[String(evCharger)];
    if (price) add('ev', `EV charger ${evCharger} kW`, price);
    else warnings.push(`Vendor does not list a ${evCharger} kW EV charger`);
  }

  const gross = items.reduce((s, i) => s + i.amount, 0);
  const sub = computeSubsidy({ kw, dcr: pkg.dcr, requested: config.prefs.subsidy }, rules);
  const net = gross - sub.amount;
  const tol = (sheet.terms.tolerancePct ?? 10) / 100;
  const stale = isStale(sheet.terms.validUntil, now);
  if (stale) warnings.push('Prices may be outdated: vendor price sheet has expired');
  const lead = [pkg.panelId, pkg.inverterId].map((id) => sheet.availability?.[id]?.leadTimeDays ?? 0);
  if ([pkg.panelId, pkg.inverterId].some((id) => sheet.availability?.[id]?.status === 'on_order')) {
    warnings.push('Some equipment is on order');
  }

  return {
    eligible: true,
    reasons: [],
    vendorId: vendor.id,
    packageId: pkg.id,
    kw,
    gross,
    subsidy: sub.amount,
    net,
    low: roundTo(net * (1 - tol), 1000),
    high: roundTo(net * (1 + tol), 1000),
    lineItems: items,
    warnings,
    stale,
    leadTimeDays: Math.max(...lead),
  };
}
