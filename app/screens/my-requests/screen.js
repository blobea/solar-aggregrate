// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { requests, reviews } from '../../api/index.js';
import { STATUS_FLOW, STATUS_LABELS, reviewPrompts } from '../../api/requests.js';
import { MILESTONES } from '../../../engine/reviews.js';
import { inr, lakhRange, date } from '../../lib/format.js';

export { template };

export default function myRequests() {
  return {
    leads: /** @type {any[]} */ ([]),
    myReviews: /** @type {any[]} */ ([]),
    loading: true,
    flow: STATUS_FLOW,
    inr, lakhRange, date,
    async init() {
      await this.load();
    },
    async load() {
      if (!Alpine.store('app').session.customerId) { this.loading = false; return; }
      [this.leads, this.myReviews] = await Promise.all([requests.listMyRequests(), reviews.listMyReviews()]);
      this.loading = false;
    },
    /** @param {string} s */
    statusLabel: (s) => STATUS_LABELS[/** @type {keyof STATUS_LABELS} */ (s)] || s,
    /** @param {string} m */
    milestoneLabel: (m) => MILESTONES[/** @type {keyof MILESTONES} */ (m)].label,
    /** @param {any} l */
    prompts: (l) => reviewPrompts(l),
    /** @param {string} m */
    promptText(m) {
      return { survey: 'How was the site survey?', install: 'Your system is installed! How did it go?', longterm: "It's been 6 months. How is your system performing?" }[/** @type {'survey'} */ (m)];
    },
    /** @param {any} l */
    deviation(l) {
      return l.finalQuote ? Math.round(((l.finalQuote.amount - l.estimate.net) / l.estimate.net) * 100) : 0;
    },
    /** @param {any} l */
    reviewsFor(l) {
      return this.myReviews.filter((r) => r.requestId === l.id);
    },
    /** @param {string} id */
    async confirmSurvey(id) {
      await requests.confirmSurvey(id);
      Alpine.store('app').toast('Survey confirmed — thanks!');
      await this.load();
    },
    /** @param {string} id */
    async resolved(id) {
      await reviews.markResolvedByVendor(id);
      await this.load();
    },
  };
}
