// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { reviews } from '../../api/index.js';
import { MILESTONES, DIMENSIONS, REASON_CODES, DISPUTE_GROUNDS, DISPUTE_OUTCOMES } from '../../../engine/reviews.js';
import { inr, date, dateTime } from '../../lib/format.js';

export { template };

export default function opsDisputes() {
  return {
    list: /** @type {any[]} */ ([]),
    tab: 'open',
    outcomes: DISPUTE_OUTCOMES,
    form: /** @type {Record<string, {outcome:string, note:string, error:string}>} */ ({}),
    inr, date, dateTime,
    async init() { await this.load(); },
    async load() {
      this.list = await reviews.listDisputes();
      for (const r of this.list) if (!this.form[r.id]) this.form[r.id] = { outcome: '', note: '', error: '' };
    },
    get open() { return this.list.filter((r) => r.dispute.outcome === 'open'); },
    get closed() { return this.list.filter((r) => r.dispute.outcome !== 'open'); },
    get shown() { return this.tab === 'open' ? this.open : this.closed; },
    /** @param {any} lead */
    dev(lead) {
      const d = Math.round(((lead.finalQuote.amount - lead.estimate.net) / lead.estimate.net) * 100);
      return `${d >= 0 ? '+' : ''}${d}%`;
    },
    /** @param {string} m */
    milestoneLabel: (m) => MILESTONES[/** @type {keyof MILESTONES} */ (m)]?.label,
    /** @param {string} d */
    dimLabel: (d) => DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)],
    /** @param {string} c */
    reasonLabel: (c) => REASON_CODES[/** @type {keyof REASON_CODES} */ (c)] || c,
    /** @param {string} g */
    groundLabel: (g) => DISPUTE_GROUNDS[/** @type {keyof DISPUTE_GROUNDS} */ (g)] || g,
    /** @param {string} id */
    async resolve(id) {
      const f = this.form[id];
      f.error = '';
      if (!f.outcome) { f.error = 'Choose an outcome'; return; }
      try {
        await reviews.resolveDispute(id, /** @type {any} */ (f.outcome), f.note);
        Alpine.store('app').toast(`Dispute resolved: ${f.outcome}`);
        await this.load();
      } catch (e) { f.error = /** @type {Error} */ (e).message; }
    },
  };
}
