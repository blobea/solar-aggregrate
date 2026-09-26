// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { sheets, catalogue } from '../../api/index.js';
import { date, dateTime } from '../../lib/format.js';
import { excelCell } from '../../lib/sheet-excel.js';

export { template };

export default function vendorSheet() {
  const vendorId = Alpine.store('app').session.vendorId;
  return {
    sheet: /** @type {any} */ (null),
    grids: /** @type {any} */ (null),
    versions: /** @type {any[]} */ ([]),
    errors: /** @type {any[]} */ ([]),
    flags: /** @type {any[]} */ ([]),
    problems: /** @type {string[]} */ ([]),
    bump: 3,
    validUntil: '',
    dirty: false,
    saving: false,
    date, dateTime, excelCell,

    async init() {
      const [sheet, cat, versions] = await Promise.all([sheets.getPriceSheet(vendorId), catalogue.getCatalogue(), sheets.listSheetVersions(vendorId)]);
      this.sheet = sheet;
      this.versions = versions;
      this.validUntil = String(sheet.terms.validUntil).slice(0, 10);
      const { createSheetGrids } = await import('../../lib/sheet-grids.js');
      const r = this.$refs;
      this.grids = await createSheetGrids(
        { packages: r.packages, structure: r.structure, site: r.site, fixed: r.fixed, addOns: r.addOns, terms: r.terms },
        sheet, cat, () => { this.dirty = true; },
      );
    },
    destroy() {
      this.grids?.destroy();
    },
    applyBump() {
      this.grids.bumpRates(Number(this.bump) || 0);
      Alpine.store('app').toast(`Applied ${this.bump}% to all package rates — review and save`);
    },
    async save() {
      this.saving = true;
      const draft = this.grids.collect();
      const r = await sheets.savePriceSheet(vendorId, draft, { savedBy: 'vendor' });
      this.saving = false;
      this.errors = r.errors;
      this.flags = r.flags;
      this.grids.mark(r.errors, r.flags);
      if (!r.ok) { Alpine.store('app').toast('Not saved — fix the highlighted cells', 'error'); return; }
      this.sheet = r.sheet;
      this.grids.load(r.sheet);
      this.grids.mark([], r.flags);
      this.versions = await sheets.listSheetVersions(vendorId);
      this.dirty = false;
      this.problems = [];
      Alpine.store('app').toast(`Saved as version ${r.sheet.version}`);
    },
    async download() {
      const { downloadSheet } = await import('../../lib/sheet-excel.js');
      await downloadSheet(this.grids.collect(), `price-sheet-${vendorId}-v${this.sheet.version}.xlsx`);
    },
    /** @param {Event} ev */
    async upload(ev) {
      const input = /** @type {HTMLInputElement} */ (ev.target);
      const file = input.files?.[0];
      if (!file) return;
      const { parseWorkbook } = await import('../../lib/sheet-excel.js');
      try {
        const { sheet, problems } = await parseWorkbook(file, this.grids.collect());
        this.problems = problems;
        this.grids.load(sheet);
        this.errors = sheets.validateSheet(sheet);
        this.flags = this.errors.length ? [] : sheets.sanityCheck({ ...sheet, vendorId });
        this.grids.mark(this.errors, this.flags);
        this.validUntil = String(sheet.terms.validUntil).slice(0, 10);
        this.dirty = true;
        Alpine.store('app').toast(this.errors.length ? `Loaded with ${this.errors.length} problem(s)` : 'Excel loaded — review and save');
      } catch (e) {
        Alpine.store('app').toast(`Could not read that file: ${/** @type {Error} */ (e).message}`, 'error');
      } finally {
        input.value = '';
      }
    },
  };
}
