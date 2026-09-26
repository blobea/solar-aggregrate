// @ts-check
/**
 * The customer's in-progress configuration and selections. Server-side later (keyed by customer);
 * here it lives in localStorage via kv.
 */
import { kv } from './store.js';

/**
 * @typedef {Object} Draft
 * @property {number} step
 * @property {any} config
 * @property {string[]} compare   vendorIds selected for comparison (max 3)
 * @property {string[]} survey    vendorIds selected for survey requests (max 3)
 * @property {string} sort
 */

/** @returns {Draft} */
export function emptyDraft() {
  return {
    step: 1,
    config: {
      pincode: '', roofAreaSqm: null, roofType: 'rcc', floors: 2, structure: 'standard',
      monthlyUnits: null, sanctionedLoadKw: 5, kw: null,
      prefs: { subsidy: true, tier: 'standard', battery: 0, evCharger: 0, finance: false },
    },
    compare: [],
    survey: [],
    sort: 'best',
  };
}

/** @returns {Draft} */
export function getDraft() {
  const d = kv.get('draft');
  return d ? { ...emptyDraft(), ...d, config: { ...emptyDraft().config, ...d.config, prefs: { ...emptyDraft().config.prefs, ...(d.config?.prefs || {}) } } } : emptyDraft();
}

/** @param {Partial<Draft>} patch */
export function saveDraft(patch) {
  const next = { ...getDraft(), ...patch };
  kv.set('draft', next);
  return next;
}

export function clearDraft() {
  kv.set('draft', null);
}
