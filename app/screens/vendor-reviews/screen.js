// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { reviews } from '../../api/index.js';
import { MILESTONES, DIMENSIONS, REASON_CODES, DISPUTE_GROUNDS, reviewScore } from '../../../engine/reviews.js';
import { date } from '../../lib/format.js';

export { template };

export default function vendorReviews() {
  const vendorId = Alpine.store('app').session.vendorId;
  return {
    list: /** @type {any[]} */ ([]),
    grounds: DISPUTE_GROUNDS,
    openReply: /** @type {string|null} */ (null),
    openDispute: /** @type {string|null} */ (null),
    replyText: '',
    ground: '',
    disputeNote: '',
    error: '',
    date,
    async init() { await this.load(); },
    async load() { this.list = await reviews.listReviewsForVendorPortal(vendorId); },
    /** @param {any} r */
    score: (r) => reviewScore(r),
    /** @param {string} m */
    milestoneLabel: (m) => MILESTONES[/** @type {keyof MILESTONES} */ (m)]?.label,
    /** @param {string} d */
    dimLabel: (d) => DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)],
    /** @param {string} c */
    reasonLabel: (c) => REASON_CODES[/** @type {keyof REASON_CODES} */ (c)] || c,
    /** @param {any} r */
    disputeText(r) {
      if (!r.dispute) return '';
      const g = DISPUTE_GROUNDS[/** @type {keyof DISPUTE_GROUNDS} */ (r.dispute.ground)];
      if (r.dispute.outcome === 'open') return `Your dispute (${g}) is with Ops. The review stays visible meanwhile.`;
      return `Ops decision: ${r.dispute.outcome}${r.dispute.opsNote ? ` — ${r.dispute.opsNote}` : ''}`;
    },
    /** @param {string} id */
    async reply(id) {
      try {
        await reviews.replyToReview(id, this.replyText);
        this.replyText = ''; this.openReply = null;
        Alpine.store('app').toast('Reply posted');
        await this.load();
      } catch (e) { Alpine.store('app').toast(/** @type {Error} */ (e).message, 'error'); }
    },
    /** @param {string} id */
    async dispute(id) {
      this.error = '';
      if (!this.ground) { this.error = 'Choose a ground'; return; }
      if (!this.disputeNote.trim()) { this.error = 'Explain the dispute for Ops'; return; }
      try {
        await reviews.disputeReview(id, this.ground, this.disputeNote.trim());
        this.ground = ''; this.disputeNote = ''; this.openDispute = null;
        Alpine.store('app').toast('Dispute sent to Ops');
        await this.load();
      } catch (e) { this.error = /** @type {Error} */ (e).message; }
    },
  };
}
