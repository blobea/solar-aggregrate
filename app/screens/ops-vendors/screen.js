// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { vendors } from '../../api/index.js';
import { daysAgo, badgeClass } from '../../lib/format.js';

export { template };

export default function opsVendors() {
  return {
    list: /** @type {any[]} */ ([]),
    daysAgo, badgeClass,
    async init() { this.list = await vendors.listVendorsOps(); },
    /** @param {string} id @param {'approved'|'suspended'} status */
    async set(id, status) {
      await vendors.setVetting(id, status);
      this.list = await vendors.listVendorsOps();
      Alpine.store('app').results = null;
      Alpine.store('app').toast(`Vendor ${status}`);
    },
  };
}
