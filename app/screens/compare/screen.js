// @ts-check
import template from './screen.html?raw';
import { drafts } from '../../api/index.js';
import { inr, lakhRange, stars, daysAgo, badgeClass, PRICE_DISCLAIMER } from '../../lib/format.js';
import { currentResults } from '../../lib/results.js';

export { template };

export default function compare() {
  return {
    cols: /** @type {any[]} */ ([]),
    loading: true,
    disclaimer: PRICE_DISCLAIMER,
    inr, lakhRange, stars, daysAgo, badgeClass,
    async init() {
      const res = await currentResults();
      const ids = drafts.getDraft().compare;
      this.cols = ids.map((id) => res.organic.find((/** @type {any} */ c) => c.vendorId === id)).filter(Boolean);
      this.loading = false;
    },
    get bestNet() {
      return Math.min(...this.cols.map((c) => c.estimate.net));
    },
    /** Union of line items across vendors, in first-seen order. Labels are generic per code. */
    get lineRows() {
      const labels = {
        system: 'Panels + inverter + install', structure: 'Mounting structure', floors: 'Height charge', distance: 'Travel beyond free radius',
        net_meter: 'Net-meter & DISCOM fee', paperwork: 'Paperwork & approvals', transport: 'Transport', battery: 'Battery', ev: 'EV charger',
      };
      const codes = [];
      for (const c of this.cols) for (const li of c.estimate.lineItems) if (!codes.includes(li.code)) codes.push(li.code);
      return codes.map((code) => ({ code, label: labels[/** @type {keyof labels} */ (code)] || code }));
    },
    /** @param {any} c @param {string} code */
    lineAmount(c, code) {
      const li = c.estimate.lineItems.find((/** @type {any} */ x) => x.code === code);
      return li ? inr(li.amount) : '—';
    },
  };
}
