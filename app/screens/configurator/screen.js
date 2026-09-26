// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { auth, catalogue, drafts, estimates } from '../../api/index.js';
import { go } from '../../router.js';
import { ROOF_LABELS, STRUCTURE_LABELS, TIER_LABELS } from '../../lib/format.js';

export { template };

/** @param {Record<string,string>} _params @param {Record<string,string>} query */
export default function configurator(_params, query) {
  const draft = drafts.getDraft();
  return {
    step: Number(query.step) || draft.step || 1,
    stepNames: ['Location', 'Roof', 'Usage', 'Preferences', 'Verify'],
    config: draft.config,
    pincodes: /** @type {{pincode:string, area:string, lat:number, lng:number}[]} */ ([]),
    roofLabels: ROOF_LABELS,
    structureLabels: STRUCTURE_LABELS,
    tierLabels: TIER_LABELS,
    errors: /** @type {Record<string,string>} */ ({}),
    usageMode: 'units',
    billAmount: /** @type {number|null} */ (null),
    sizing: /** @type {any} */ (null),
    kwValue: 0,
    generation: 0,
    mapApi: /** @type {any} */ (null),
    drawnArea: 0,
    drawnPoints: 0,
    phone: '',
    otp: '',
    otpSent: false,
    otpHint: '',

    async init() {
      this.pincodes = await catalogue.getPincodes();
      this.$watch('config', () => { drafts.saveDraft({ config: this.config }); this.refreshSizing(); });
      this.$watch('step', (s) => { drafts.saveDraft({ step: s }); this.onStep(); });
      this.refreshSizing();
      this.onStep();
    },
    destroy() {
      this.mapApi?.destroy();
    },

    get areaName() {
      return this.pincodes.find((p) => p.pincode === this.config.pincode)?.area || '';
    },
    get sizingNote() {
      const s = this.sizing;
      if (!s) return '';
      if (this.config.kw) return 'Custom size';
      return { usage: 'Sized to cover your usage', roof: 'Limited by roof area', sanctioned: 'Limited by sanctioned load' }[/** @type {'usage'} */ (s.limitingFactor)];
    },

    async onStep() {
      if (this.step === 2 && !this.mapApi) {
        await this.$nextTick();
        const p = this.pincodes.find((x) => x.pincode === this.config.pincode) || this.pincodes[0];
        if (!p) return;
        try {
          const { createRoofMap } = await import('../../lib/roof-map.js');
          this.mapApi = await createRoofMap(/** @type {HTMLElement} */ (this.$refs.map), p, (area, pts) => {
            this.drawnArea = area;
            this.drawnPoints = pts.length;
          });
        } catch (e) {
          console.warn('Map unavailable', e);
        }
      } else if (this.step === 2 && this.mapApi) {
        this.mapApi.invalidate();
      }
    },

    async refreshSizing() {
      const c = this.config;
      if (!(c.monthlyUnits > 0 && c.roofAreaSqm > 0 && c.sanctionedLoadKw > 0)) { this.sizing = null; return; }
      const r = await estimates.previewSizing(c);
      this.sizing = r.sizing;
      this.kwValue = r.kw;
      this.generation = r.monthlyGeneration;
    },
    /** @param {string} v */
    setKw(v) {
      const kw = Number(v);
      this.config.kw = kw === this.sizing?.recommendedKw ? null : kw;
    },
    async convertBill() {
      if (this.billAmount && this.billAmount > 0) {
        this.config.monthlyUnits = await estimates.billToUnits(this.billAmount, this.config.sanctionedLoadKw);
      }
    },

    validate() {
      /** @type {Record<string,string>} */
      const e = {};
      const c = this.config;
      if (this.step === 1 && !this.pincodes.some((p) => p.pincode === c.pincode)) e.pincode = 'Enter one of the supported Bengaluru pincodes';
      if (this.step === 2) {
        if (!(c.roofAreaSqm >= 5)) e.roofAreaSqm = 'Enter a roof area of at least 5 m² (or draw it on the map)';
        if (!(c.floors >= 1 && c.floors <= 10)) e.floors = 'Floors must be 1–10';
      }
      if (this.step === 3) {
        if (!(c.monthlyUnits >= 30)) e.monthlyUnits = 'Enter at least 30 units a month';
        if (!(c.sanctionedLoadKw >= 1 && c.sanctionedLoadKw <= 25)) e.sanctionedLoadKw = 'Sanctioned load must be 1–25 kW';
      }
      this.errors = e;
      return !Object.keys(e).length;
    },

    async next() {
      if (!this.validate()) {
        this.$nextTick(() => /** @type {HTMLElement|null} */ (this.$root.querySelector('[aria-invalid="true"]'))?.focus());
        return;
      }
      if (this.step < 5) { this.step++; return; }
      if (!Alpine.store('app').session.customerId) {
        const ok = await this.verifyOtp();
        if (!ok) return;
      }
      Alpine.store('app').results = null;
      go('/results');
    },
    back() {
      if (this.step > 1) this.step--;
    },

    async sendOtp() {
      const r = await auth.requestOtp(this.phone);
      if (!r.ok) { this.errors = { phone: r.error || '' }; return; }
      this.errors = {};
      this.otpSent = true;
      this.otpHint = r.hint || '';
      this.$nextTick(() => document.getElementById('otp')?.focus());
    },
    async verifyOtp() {
      if (!this.otpSent) { await this.sendOtp(); return false; }
      const r = await auth.verifyOtp(this.phone, this.otp);
      if (!r.ok) { this.errors = { phone: r.error || '' }; return false; }
      Alpine.store('app').refreshSession();
      Alpine.store('app').toast('Phone verified');
      return true;
    },
  };
}
