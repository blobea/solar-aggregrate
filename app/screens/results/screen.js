// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { drafts, estimates, catalogue } from '../../api/index.js';
import { go } from '../../router.js';
import { inr, lakh, lakhRange, num, stars, daysAgo, badgeClass, PRICE_DISCLAIMER } from '../../lib/format.js';

export { template };

export default function results() {
  const draft = drafts.getDraft();
  return {
    res: /** @type {any} */ (null),
    loading: true,
    error: '',
    sort: draft.sort || 'best',
    filter: 'all',
    compare: /** @type {string[]} */ (draft.compare || []),
    area: '',
    disclaimer: PRICE_DISCLAIMER,
    inr, lakh, lakhRange, num, stars, daysAgo, badgeClass,

    async init() {
      if (!Alpine.store('app').session.customerId) { go('/configure?step=5'); return; }
      if (!draft.config.pincode || !draft.config.monthlyUnits) { go('/configure?step=1'); return; }
      const pins = await catalogue.getPincodes();
      this.area = pins.find((p) => p.pincode === draft.config.pincode)?.area || draft.config.pincode;
      await this.load();
    },

    async load() {
      this.loading = true;
      drafts.saveDraft({ sort: this.sort });
      try {
        const res = await estimates.getEstimates(drafts.getDraft().config, { sort: /** @type {any} */ (this.sort) });
        this.res = res;
        Alpine.store('app').results = res;
        const ids = new Set(res.organic.map((/** @type {any} */ c) => c.vendorId));
        this.compare = this.compare.filter((id) => ids.has(id));
        await this.$nextTick();
        this.drawChart();
      } catch (e) {
        this.error = `Could not load estimates: ${/** @type {Error} */ (e).message}`;
      } finally {
        this.loading = false;
      }
    },

    async drawChart() {
      const canvas = /** @type {HTMLCanvasElement|undefined} */ (this.$refs.chart);
      if (!canvas || !this.res) return;
      const { drawSavingsChart } = await import('../../lib/savings-chart.js');
      drawSavingsChart(canvas, this.res.savings.series, this.res.typicalNet);
    },

    get headline() {
      if (!this.res) return '';
      const n = this.res.organic.length;
      return `${n} vendors can install ${this.res.kw} kW at your home in ${this.area}. Prices are all-in and include the subsidy where eligible.`;
    },
    get sizingNote() {
      const s = this.res?.sizing;
      if (!s) return '';
      if (drafts.getDraft().config.kw) return 'your chosen size';
      return { usage: 'covers your usage', roof: 'limited by roof', sanctioned: 'limited by load' }[/** @type {'usage'} */ (s.limitingFactor)];
    },
    get visible() {
      if (!this.res) return [];
      return this.res.organic.filter((/** @type {any} */ c) => {
        if (this.filter === 'fresh') return !c.stale;
        if (this.filter === 'accurate') return c.accuracy.badge === 'green';
        if (this.filter === 'rated') return c.rating >= 4;
        return true;
      });
    },
    /** Sponsored card (if any) first, clearly labelled; organic list unchanged below. */
    get cards() {
      const list = this.visible;
      return this.res?.sponsored ? [this.res.sponsored, ...list] : list;
    },

    /** @param {string} id */
    inCompare(id) {
      return this.compare.includes(id);
    },
    /** @param {string} id */
    toggleCompare(id) {
      if (this.inCompare(id)) this.compare = this.compare.filter((x) => x !== id);
      else if (this.compare.length >= 3) { Alpine.store('app').toast('You can compare up to 3 vendors'); return; }
      else this.compare = [...this.compare, id];
      drafts.saveDraft({ compare: this.compare, survey: this.compare });
    },
  };
}
