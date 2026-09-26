// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { vendors } from '../../api/index.js';
import { date, daysAgo, badgeClass } from '../../lib/format.js';

export { template };

export default function vendorDashboard() {
  return {
    d: /** @type {any} */ (null),
    date, daysAgo, badgeClass,
    async init() {
      this.d = await vendors.getVendorDashboard(Alpine.store('app').session.vendorId);
    },
  };
}
