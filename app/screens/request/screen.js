// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { drafts } from '../../api/index.js';
import { go } from '../../router.js';
import { lakhRange } from '../../lib/format.js';
import { currentResults } from '../../lib/results.js';

export { template };

export default function request() {
  const d = drafts.getDraft();
  return {
    list: /** @type {any[]} */ ([]),
    picked: /** @type {string[]} */ ((d.survey?.length ? d.survey : d.compare) || []).slice(0, 3),
    error: '',
    lakhRange,
    async init() {
      if (!Alpine.store('app').session.customerId) { go('/configure?step=5'); return; }
      const res = await currentResults();
      this.list = res.organic;
      this.picked = this.picked.filter((id) => this.list.some((c) => c.vendorId === id));
    },
    /** @param {string} id @param {Event} ev */
    toggle(id, ev) {
      const box = /** @type {HTMLInputElement} */ (ev.target);
      if (box.checked) {
        if (this.picked.length >= 3) { box.checked = false; this.error = 'You can request up to 3 surveys.'; return; }
        this.picked = [...this.picked, id];
      } else {
        this.picked = this.picked.filter((x) => x !== id);
      }
      this.error = '';
      drafts.saveDraft({ survey: this.picked });
    },
    next() {
      if (!this.picked.length) { this.error = 'Choose at least one vendor.'; return; }
      drafts.saveDraft({ survey: this.picked });
      go('/consent');
    },
  };
}
