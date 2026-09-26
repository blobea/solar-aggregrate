// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { catalogue } from '../../api/index.js';

export { template };

export default function opsRules() {
  return {
    r: /** @type {any} */ (null),
    e: /** @type {Record<string,string>} */ ({}),
    async init() {
      this.r = await catalogue.getCityRules();
      this.e = {};
    },
    addSlab() {
      const slabs = this.r.tariff.slabs;
      const prevLast = slabs[slabs.length - 1];
      const prevUp = slabs.length > 1 ? slabs[slabs.length - 2].upTo : 0;
      prevLast.upTo = (prevUp || 0) + 200;
      slabs.push({ upTo: null, rate: prevLast.rate + 0.5 });
    },
    /** @param {number} i */
    removeSlab(i) {
      this.r.tariff.slabs.splice(i, 1);
      this.r.tariff.slabs[this.r.tariff.slabs.length - 1].upTo = null;
    },
    async save() {
      const res = await catalogue.updateCityRules(JSON.parse(JSON.stringify(this.r)));
      this.e = res.errors;
      if (!res.ok) return;
      Alpine.store('app').results = null;
      Alpine.store('app').toast('City rules saved — new estimates will use them');
    },
  };
}
