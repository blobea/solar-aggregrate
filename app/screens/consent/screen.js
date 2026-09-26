// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { auth, drafts, requests } from '../../api/index.js';
import { go } from '../../router.js';
import { currentResults } from '../../lib/results.js';

export { template };

export default function consent() {
  const me = auth.currentCustomer();
  return {
    name: me?.name || '',
    address: me?.address || '',
    consent: false, // never pre-ticked
    picked: /** @type {any[]} */ ([]),
    error: '',
    busy: false,
    async init() {
      if (!Alpine.store('app').session.customerId) { go('/configure?step=5'); return; }
      const res = await currentResults();
      const ids = drafts.getDraft().survey;
      this.picked = ids.map((id) => res.organic.find((/** @type {any} */ c) => c.vendorId === id)).filter(Boolean);
      if (!this.picked.length) go('/request');
    },
    get vendorNames() {
      return this.picked.map((c) => c.vendorName).join(', ');
    },
    async submit() {
      this.error = '';
      if (!this.name.trim() || !this.address.trim()) { this.error = 'Please enter your name and address.'; return; }
      if (!this.consent) { this.error = 'Please tick the box to agree to share your details.'; return; }
      this.busy = true;
      const r = await requests.createRequests({ logIds: this.picked.map((c) => c.logId), consent: this.consent, name: this.name.trim(), address: this.address.trim() });
      this.busy = false;
      if (!r.ok) { this.error = r.error || 'Something went wrong'; return; }
      Alpine.store('app').refreshSession();
      drafts.saveDraft({ survey: [], compare: [] });
      go(`/requested/${r.requestId}`);
    },
  };
}
