// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { requests, reviews } from '../../api/index.js';
import { go } from '../../router.js';
import { MILESTONES, DIMENSIONS, REASON_CODES } from '../../../engine/reviews.js';

export { template };

/** @param {{leadId:string, milestone:'survey'|'install'|'longterm'}} params */
export default function reviewForm(params) {
  const m = MILESTONES[params.milestone] || MILESTONES.survey;
  return {
    lead: /** @type {any} */ (null),
    milestone: params.milestone,
    milestoneLabel: m.label,
    dims: m.dims,
    reasonCodes: REASON_CODES,
    scores: /** @type {Record<string, number>} */ ({}),
    reasons: /** @type {Record<string, string>} */ ({}),
    evidence: '',
    generationReading: /** @type {number|null} */ (null),
    text: '',
    errors: /** @type {string[]} */ ([]),
    async init() {
      this.lead = await requests.getLead(params.leadId);
      if (this.lead?.invoiceNo) this.evidence = this.lead.invoiceNo;
    },
    /** @param {string} d */
    dimLabel: (d) => DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)],
    async submit() {
      const r = await reviews.submitReview({
        leadId: params.leadId, milestone: params.milestone, scores: { ...this.scores }, reasons: { ...this.reasons },
        text: this.text, evidence: this.evidence, generationReading: this.generationReading || undefined,
      });
      if (!r.ok) { this.errors = r.errors; return; }
      Alpine.store('app').toast('Thanks! Your review will be published after the 72-hour check.');
      go('/my-requests');
    },
  };
}
