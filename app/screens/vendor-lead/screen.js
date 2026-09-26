// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { requests } from '../../api/index.js';
import { STATUS_FLOW, STATUS_LABELS } from '../../api/requests.js';
import { inr, lakhRange, date, dateTime, ROOF_LABELS, STRUCTURE_LABELS } from '../../lib/format.js';

export { template };

/** @param {{id:string}} params */
export default function vendorLead(params) {
  return {
    l: /** @type {any} */ (null),
    flow: STATUS_FLOW,
    surveyDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    quote: /** @type {number|null} */ (null),
    quoteNote: '',
    invoice: '',
    error: '',
    inr, lakhRange, date, dateTime,
    async init() {
      this.l = await requests.getLead(params.id);
      if (this.l && this.l.vendorId !== Alpine.store('app').session.vendorId) this.l = null;
    },
    get quoteDev() {
      return this.quote && this.l ? Math.round(((this.quote - this.l.estimate.net) / this.l.estimate.net) * 100) : 0;
    },
    /** @param {string} s */
    statusLabel: (s) => STATUS_LABELS[/** @type {keyof STATUS_LABELS} */ (s)] || s,
    /** @param {string} r */
    roofLabel: (r) => ROOF_LABELS[/** @type {keyof ROOF_LABELS} */ (r)] || r,
    /** @param {string} s */
    structureLabel: (s) => STRUCTURE_LABELS[/** @type {keyof STRUCTURE_LABELS} */ (s)] || s,
    /** @param {'schedule'|'surveyDone'|'quote'|'installed'} action */
    async act(action) {
      this.error = '';
      try {
        if (action === 'schedule') this.l = await requests.scheduleSurvey(params.id, new Date(this.surveyDate).toISOString());
        if (action === 'surveyDone') this.l = await requests.markSurveyDone(params.id);
        if (action === 'quote') this.l = await requests.logFinalQuote(params.id, Number(this.quote), this.quoteNote);
        if (action === 'installed') this.l = await requests.markInstalled(params.id, this.invoice);
        Alpine.store('app').toast(`Updated: ${this.statusLabel(this.l.status)}`);
      } catch (e) {
        this.error = /** @type {Error} */ (e).message;
      }
    },
  };
}
