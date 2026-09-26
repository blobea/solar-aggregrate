// @ts-check
import template from './screen.html?raw';
import { estimates } from '../../api/index.js';
import { inr, lakhRange, dateTime } from '../../lib/format.js';

export { template };

export default function opsEstimates() {
  return {
    list: /** @type {any[]} */ ([]),
    q: '',
    limit: 50,
    inr, lakhRange, dateTime,
    async init() { this.list = await estimates.listEstimatesLog(); },
    get filtered() {
      const q = this.q.trim().toLowerCase();
      if (!q) return this.list;
      return this.list.filter((e) => [e.customerName, e.phone, e.vendorName, e.pincode].some((x) => String(x || '').toLowerCase().includes(q)));
    },
    get page() { return this.filtered.slice(0, this.limit); },
  };
}
