// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { sheets, catalogue } from '../../api/index.js';
import { excelCell } from '../../lib/sheet-excel.js';

export { template };

export default function opsImport() {
  return {
    vendorId: 'v-arka',
    grids: /** @type {any} */ (null),
    cat: /** @type {any} */ (null),
    errors: /** @type {any[]} */ ([]),
    flags: /** @type {any[]} */ ([]),
    loaded: false,
    fileName: '',
    excelCell,
    async init() {
      this.cat = await catalogue.getCatalogue();
      await this.loadVendor();
    },
    destroy() { this.grids?.destroy(); },
    async loadVendor() {
      const sheet = await sheets.getPriceSheet(this.vendorId);
      this.errors = []; this.flags = []; this.loaded = false;
      if (this.grids) { this.grids.load(sheet); this.grids.mark([], []); return; }
      const { createSheetGrids } = await import('../../lib/sheet-grids.js');
      const r = this.$refs;
      this.grids = await createSheetGrids({ packages: r.packages, structure: r.structure, site: r.site, fixed: r.fixed, addOns: r.addOns, terms: r.terms }, sheet, this.cat);
    },
    async template_() {
      const { downloadSheet } = await import('../../lib/sheet-excel.js');
      await downloadSheet(this.grids.collect(), `price-sheet-${this.vendorId}.xlsx`);
    },
    check() {
      const s = { ...this.grids.collect(), vendorId: this.vendorId };
      this.errors = sheets.validateSheet(s);
      this.flags = sheets.sanityCheck(s);
      this.grids.mark(this.errors, this.flags);
    },
    /** @param {Event} ev */
    async upload(ev) {
      const input = /** @type {HTMLInputElement} */ (ev.target);
      const file = input.files?.[0];
      if (!file) return;
      const { parseWorkbook } = await import('../../lib/sheet-excel.js');
      try {
        const { sheet } = await parseWorkbook(file, this.grids.collect());
        this.grids.load(sheet);
        this.loaded = true;
        this.fileName = file.name;
        this.check();
      } catch (e) {
        Alpine.store('app').toast(`Could not read file: ${/** @type {Error} */ (e).message}`, 'error');
      } finally { input.value = ''; }
    },
    async save() {
      const r = await sheets.savePriceSheet(this.vendorId, this.grids.collect(), { savedBy: 'ops (import)' });
      this.errors = r.errors; this.flags = r.flags;
      this.grids.mark(r.errors, r.flags);
      if (!r.ok) { Alpine.store('app').toast('Fix validation errors first', 'error'); return; }
      Alpine.store('app').results = null;
      Alpine.store('app').toast(`Saved version ${r.sheet.version} for ${this.vendorId}`);
    },
  };
}
