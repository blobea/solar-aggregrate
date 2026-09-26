// @ts-check
import { doc, delay, clone, ensureSeeded } from './store.js';

/** @returns {import('../../engine/types.js').CityRules & {discom:string, netMeteringDefaults:any}} */
export function rulesSync() {
  ensureSeeded();
  return doc.get('cityRules');
}
export function catalogueSync() {
  ensureSeeded();
  return doc.get('catalogue');
}

export async function getCityRules() {
  await delay();
  return clone(rulesSync());
}

export async function getCatalogue() {
  await delay();
  return clone(catalogueSync());
}

export async function getPincodes() {
  await delay(0);
  return rulesSync().pincodes.map(({ pincode, area, lat, lng }) => ({ pincode, area, lat, lng }));
}

/** Look up a catalogue item by id across all categories. @param {string} id */
export function catalogueItem(id) {
  const c = catalogueSync();
  for (const cat of ['panels', 'inverters', 'batteries', 'evChargers']) {
    const hit = c[cat].find((/** @type {any} */ x) => x.id === id);
    if (hit) return { ...hit, category: cat };
  }
  return null;
}

/** @param {any} item */
export const itemLabel = (item) => (item ? `${item.brand} ${item.model}` : '—');

/**
 * Validate city rules edited by Ops. Returns field → message.
 * @param {any} r
 */
export function validateCityRules(r) {
  /** @type {Record<string,string>} */
  const e = {};
  const num = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v);
  if (!num(r.yieldPerKwDay) || r.yieldPerKwDay < 2 || r.yieldPerKwDay > 7) e.yieldPerKwDay = 'Yield must be 2–7 units/kW/day';
  if (!num(r.areaPerKwSqm) || r.areaPerKwSqm < 4 || r.areaPerKwSqm > 15) e.areaPerKwSqm = 'Area per kW must be 4–15 m²';
  const slabs = r.tariff?.slabs || [];
  if (!slabs.length) e.slabs = 'At least one tariff slab';
  slabs.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    if (!num(s.rate) || s.rate <= 0 || s.rate > 30) e[`slab${i}`] = 'Rate must be ₹0–30/unit';
    const last = i === slabs.length - 1;
    if (!last && (!num(s.upTo) || s.upTo <= (slabs[i - 1]?.upTo ?? 0))) e[`slab${i}`] = 'Slab limits must increase';
    if (last && s.upTo != null) e[`slab${i}`] = 'Last slab must be open-ended';
  });
  const sub = r.subsidy || {};
  if (!num(sub.perKwFirst2) || sub.perKwFirst2 < 0) e.perKwFirst2 = 'Enter a non-negative amount';
  if (!num(sub.thirdKw) || sub.thirdKw < 0) e.thirdKw = 'Enter a non-negative amount';
  if (!num(sub.cap) || sub.cap < 0) e.cap = 'Enter a non-negative cap';
  if (num(sub.cap) && num(sub.perKwFirst2) && num(sub.thirdKw) && sub.cap > sub.perKwFirst2 * 2 + sub.thirdKw) {
    e.cap = 'Cap cannot exceed the slab total';
  }
  if (!num(r.tariff?.exportRate) || r.tariff.exportRate < 0) e.exportRate = 'Export rate must be ≥ 0';
  return e;
}

/** Ops: update city rules (validated). @param {any} next */
export async function updateCityRules(next) {
  await delay();
  const errors = validateCityRules(next);
  if (Object.keys(errors).length) return { ok: false, errors };
  doc.set('cityRules', { ...rulesSync(), ...clone(next) });
  return { ok: true, errors: {} };
}
