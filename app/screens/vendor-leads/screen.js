// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { requests } from '../../api/index.js';
import { STATUS_LABELS } from '../../api/requests.js';
import { inr, date } from '../../lib/format.js';

export { template };

export default function vendorLeads() {
  return {
    leads: /** @type {any[]} */ ([]),
    tab: 'open',
    tabs: [{ key: 'open', label: 'Open' }, { key: 'new', label: 'New' }, { key: 'installed', label: 'Installed' }, { key: 'all', label: 'All' }],
    inr, date,
    async init() {
      this.leads = await requests.listLeads(Alpine.store('app').session.vendorId);
    },
    /** @param {string} key */
    filterFor(key) {
      if (key === 'new') return this.leads.filter((l) => l.status === 'sent');
      if (key === 'open') return this.leads.filter((l) => l.status !== 'installed');
      if (key === 'installed') return this.leads.filter((l) => l.status === 'installed');
      return this.leads;
    },
    /** @param {string} key */
    count(key) { return this.filterFor(key).length; },
    get shown() { return this.filterFor(this.tab); },
    /** @param {string} s */
    statusLabel: (s) => STATUS_LABELS[/** @type {keyof STATUS_LABELS} */ (s)] || s,
  };
}
