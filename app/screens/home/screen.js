// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { demo, drafts, vendors } from '../../api/index.js';
import { go } from '../../router.js';

export { template };

export default function home() {
  return {
    example: '₹1.35–1.60 L',
    vendorCount: '8',
    async init() {
      const list = await vendors.listVendorNames();
      this.vendorCount = String(list.filter((v) => v.vetting === 'approved').length);
    },
    async demoCustomer() {
      await demo.signInDemoCustomer();
      drafts.saveDraft({ ...drafts.emptyDraft(), step: 5, config: structuredClone(demo.DEMO_CONFIG) });
      Alpine.store('app').refreshSession();
      Alpine.store('app').results = null;
      go('/results');
    },
  };
}
