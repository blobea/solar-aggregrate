// @ts-check
import template from './screen.html?raw';
import { vendors, reviews, catalogue } from '../../api/index.js';
import { MILESTONES, DIMENSIONS, REASON_CODES, DISPUTE_GROUNDS, EXTERNAL_CODES, reviewScore } from '../../../engine/reviews.js';
import { num, stars, date, daysAgo, badgeClass } from '../../lib/format.js';

export { template };

/** @param {{id:string}} params */
export default function vendorProfile(params) {
  return {
    v: /** @type {any} */ (null),
    list: /** @type {any[]} */ ([]),
    areas: '',
    fMilestone: '',
    fScore: '',
    fReply: false,
    num, stars, date, daysAgo, badgeClass,
    async init() {
      const [v, list, pins] = await Promise.all([vendors.getVendorProfile(params.id), reviews.listVendorReviews(params.id), catalogue.getPincodes()]);
      this.v = v;
      this.list = list;
      const served = new Set(v?.public?.servicePincodes || []);
      this.areas = pins.filter((p) => served.has(p.pincode)).map((p) => p.area).join(', ');
    },
    get filtered() {
      return this.list.filter((r) => {
        if (this.fMilestone && r.milestone !== this.fMilestone) return false;
        const s = reviewScore(r);
        if (this.fScore === 'low' && !(s != null && s <= 2.5)) return false;
        if (this.fScore === 'high' && !(s != null && s >= 4)) return false;
        if (this.fReply && !r.reply) return false;
        return true;
      });
    },
    /** @param {any} r */
    score: (r) => reviewScore(r),
    /** @param {any} r */
    hasExternal: (r) => Object.values(r.reasons || {}).some((c) => EXTERNAL_CODES.includes(/** @type {string} */ (c))),
    /** @param {string} m */
    milestoneLabel: (m) => MILESTONES[/** @type {keyof MILESTONES} */ (m)]?.label,
    /** @param {string} d */
    dimLabel: (d) => DIMENSIONS[/** @type {keyof DIMENSIONS} */ (d)],
    /** @param {string} c */
    reasonLabel: (c) => REASON_CODES[/** @type {keyof REASON_CODES} */ (c)] || c,
    /** @param {string} g */
    groundLabel: (g) => DISPUTE_GROUNDS[/** @type {keyof DISPUTE_GROUNDS} */ (g)] || g,
  };
}
