// @ts-check
/**
 * Tabulator grids for editing a price sheet. Used by the vendor editor and the Ops import screen.
 * Validation errors ({section,row,field}) and sanity flags are painted onto the matching cells.
 */
import { SLABS } from '../../engine/estimate.js';
import { kvSections } from './sheet-excel.js';

const ROOFS = ['rcc', 'sheet', 'tile'];
const STRUCTS = ['standard', 'elevated_6ft', 'elevated_10ft'];
const KV_SECTIONS = { site: 'Site', fixed: 'Fixed', addOns: 'AddOns', terms: 'Terms' };
const KV_LABELS = {
  perFloorAbove2: '₹ per floor above 2', freeRadiusKm: 'Free radius (km)', perKmBeyond: '₹ per km beyond',
  netMeterFee: 'Net-meter & DISCOM fee (₹)', paperwork: 'Paperwork (₹)', transport: 'Transport (₹)',
  batteryPerKwh: 'Battery ₹/kWh', monitoring: 'Monitoring (₹)', amcPerYear: 'AMC ₹/year',
  workmanshipWarrantyYears: 'Workmanship warranty (years)', paymentMilestones: 'Payment milestones', validUntil: 'Valid until (YYYY-MM-DD)',
  tolerancePct: 'Estimate tolerance (%)', kwMin: 'Min system (kW)', kwMax: 'Max system (kW)', servicePincodes: 'Service pincodes (comma-separated)',
};
const TEXT_KEYS = ['paymentMilestones', 'validUntil', 'servicePincodes'];

/**
 * @param {Record<string, HTMLElement>} hosts  keys: packages, structure, site, fixed, addOns, terms
 * @param {any} sheet
 * @param {{panels:any[], inverters:any[]}} catalogue
 * @param {() => void} [onEdit]
 */
export async function createSheetGrids(hosts, sheet, catalogue, onEdit = () => {}) {
  const [{ TabulatorFull: Tabulator }] = await Promise.all([
    import('tabulator-tables'),
    import('tabulator-tables/dist/css/tabulator_simple.min.css'),
  ]);
  /** @type {Map<string, {msg:string, kind:'error'|'flag'}>} */
  let marks = new Map();
  let base = structuredClone(sheet);

  /** Formatter that paints error/flag state and formats numbers. @param {string} section */
  const fmt = (section) => (/** @type {any} */ cell) => {
    const row = cell.getRow().getData();
    const field = cell.getField() === 'value' ? row.field : cell.getField();
    const key = `${section}:${row._i}:${field}`;
    const m = marks.get(key);
    const el = cell.getElement();
    el.classList.toggle('cell-error', m?.kind === 'error');
    el.classList.toggle('cell-flag', m?.kind === 'flag');
    el.title = m ? m.msg : '';
    const v = cell.getValue();
    return typeof v === 'number' ? v.toLocaleString('en-IN') : v == null ? '' : String(v);
  };
  const common = { layout: 'fitDataStretch', reactiveData: false, headerSort: false, columnDefaults: { headerSort: false }, index: '_i', height: false };
  const fitted = { ...common, layout: 'fitColumns' };

  const panelIds = catalogue.panels.map((p) => p.id);
  const inverterIds = catalogue.inverters.map((p) => p.id);
  const pkgRows = (/** @type {any} */ s) => s.packages.map((/** @type {any} */ p, /** @type {number} */ i) => ({
    _i: i, id: p.id, name: p.name, tier: p.tier, dcr: p.dcr, panelId: p.panelId, inverterId: p.inverterId,
    ...Object.fromEntries(SLABS.map((sl) => [`rate_${sl}`, p.ratesPerKw[sl]])),
  }));
  const tables = {};
  tables.packages = new Tabulator(hosts.packages, {
    ...common,
    data: pkgRows(sheet),
    columns: [
      { title: 'ID', field: 'id', editor: 'input', formatter: fmt('packages'), frozen: true },
      { title: 'Name', field: 'name', editor: 'input', formatter: fmt('packages') },
      { title: 'Tier', field: 'tier', editor: 'list', editorParams: { values: ['economy', 'standard', 'premium'] }, formatter: fmt('packages') },
      { title: 'DCR', field: 'dcr', editor: 'tickCross', hozAlign: 'center', formatter: (/** @type {any} */ c) => { fmt('packages')(c); return c.getValue() ? '✔' : '—'; } },
      { title: 'Panel', field: 'panelId', editor: 'list', editorParams: { values: panelIds }, formatter: fmt('packages') },
      { title: 'Inverter', field: 'inverterId', editor: 'list', editorParams: { values: inverterIds }, formatter: fmt('packages') },
      ...SLABS.map((sl) => ({ title: `₹/kW ${sl}`, field: `rate_${sl}`, editor: 'number', hozAlign: 'right', formatter: fmt('packages') })),
    ],
  });
  tables.structure = new Tabulator(hosts.structure, {
    ...fitted,
    data: ROOFS.map((r, i) => ({ _i: i, roofType: r, ...sheet.structure[r] })),
    columns: [
      { title: 'Roof type (₹/kW)', field: 'roofType', formatter: fmt('structure') },
      ...STRUCTS.map((x) => ({ title: x.replace('_', ' '), field: x, editor: 'number', hozAlign: 'right', formatter: fmt('structure') })),
    ],
  });
  const kvRows = (/** @type {any} */ s, /** @type {string} */ tab) => /** @type {any} */ (kvSections(s))[tab].map((/** @type {any[]} */ [field, value]) => ({
    _i: 0, field, label: /** @type {any} */ (KV_LABELS)[field] || (field.startsWith('ev_') ? `EV charger ${field.slice(3)} kW (₹)` : field), value,
  }));
  for (const [section, tab] of Object.entries(KV_SECTIONS)) {
    tables[section] = new Tabulator(hosts[section], {
      ...fitted,
      data: kvRows(sheet, tab),
      columns: [
        { title: 'Item', field: 'label', widthGrow: 2 },
        { title: 'Value', field: 'value', widthGrow: 1, hozAlign: 'right', formatter: fmt(section),
          editor: (/** @type {any} */ cell, /** @type {any} */ onRendered, /** @type {any} */ success, /** @type {any} */ cancel) => {
            const input = document.createElement('input');
            input.value = cell.getValue() ?? '';
            input.style.cssText = 'width:100%;box-sizing:border-box;padding:4px';
            onRendered(() => input.focus());
            const done = () => {
              const f = cell.getRow().getData().field;
              success(TEXT_KEYS.includes(f) ? input.value : Number(String(input.value).replace(/[,₹\s]/g, '')));
            };
            input.addEventListener('blur', done);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); if (e.key === 'Escape') cancel(); });
            return input;
          } },
      ],
    });
  }
  const all = /** @type {any[]} */ (Object.values(tables));
  await Promise.all(all.map((t) => new Promise((r) => t.on('tableBuilt', r))));
  all.forEach((t) => t.on('cellEdited', onEdit));

  /** Read all grids back into a sheet object (packages order = grid order). */
  function collect() {
    const s = structuredClone(base);
    const pk = tables.packages.getData();
    s.packages = pk.map((/** @type {any} */ r) => ({
      id: r.id, name: r.name, tier: r.tier, dcr: !!r.dcr, panelId: r.panelId, inverterId: r.inverterId,
      ratesPerKw: Object.fromEntries(SLABS.map((sl) => [sl, Number(r[`rate_${sl}`])])),
    }));
    for (const r of tables.structure.getData()) for (const x of STRUCTS) s.structure[r.roofType][x] = Number(r[x]);
    /** @param {string} sec */
    const kv = (sec) => Object.fromEntries(tables[sec].getData().map((/** @type {any} */ r) => [r.field, r.value]));
    const site = kv('site'); const fixed = kv('fixed'); const add = kv('addOns'); const t = kv('terms');
    s.site = { perFloorAbove2: site.perFloorAbove2, freeRadiusKm: site.freeRadiusKm, perKmBeyond: site.perKmBeyond };
    s.fixed = { netMeterFee: fixed.netMeterFee, paperwork: fixed.paperwork, transport: fixed.transport };
    s.addOns = { batteryPerKwh: add.batteryPerKwh, monitoring: add.monitoring, amcPerYear: add.amcPerYear,
      evCharger: Object.fromEntries(Object.entries(add).filter(([k]) => k.startsWith('ev_')).map(([k, v]) => [k.slice(3), v])) };
    s.terms = { ...s.terms, workmanshipWarrantyYears: t.workmanshipWarrantyYears, paymentMilestones: String(t.paymentMilestones),
      validUntil: String(t.validUntil), tolerancePct: t.tolerancePct };
    s.kwRange = [Number(t.kwMin), Number(t.kwMax)];
    s.servicePincodes = String(t.servicePincodes).split(/[,\s]+/).filter(Boolean);
    return s;
  }

  return {
    collect,
    /** Replace all grid data with a sheet (e.g. after Excel upload). @param {any} s */
    load(s) {
      base = structuredClone(s);
      tables.packages.replaceData(pkgRows(s));
      tables.structure.replaceData(ROOFS.map((r, i) => ({ _i: i, roofType: r, ...s.structure[r] })));
      for (const [section, tab] of Object.entries(KV_SECTIONS)) tables[section].replaceData(kvRows(s, tab));
    },
    /** @param {number} pct */
    bumpRates(pct) {
      const f = 1 + pct / 100;
      tables.packages.getRows().forEach((/** @type {any} */ row) => {
        const d = row.getData();
        row.update(Object.fromEntries(SLABS.map((sl) => [`rate_${sl}`, Math.round((Number(d[`rate_${sl}`]) * f) / 100) * 100])));
      });
      onEdit();
    },
    addPackage() {
      const n = tables.packages.getDataCount();
      tables.packages.addRow({ _i: n, id: `pkg-${n + 1}`, name: 'New package', tier: 'standard', dcr: true, panelId: panelIds[0], inverterId: inverterIds[0],
        ...Object.fromEntries(SLABS.map((sl) => [`rate_${sl}`, 50000])) });
    },
    removeLastPackage() {
      const rows = tables.packages.getRows();
      if (rows.length > 1) rows[rows.length - 1].delete();
    },
    /** @param {string} iso */
    setValidUntil(iso) {
      const row = tables.terms.getRows().find((/** @type {any} */ r) => r.getData().field === 'validUntil');
      row?.update({ value: iso });
    },
    /**
     * Paint validation errors and sanity flags onto cells.
     * @param {{section:string,row:number|null,field:string,message:string}[]} errors
     * @param {{packageIndex:number, slab:string, deviationPct:number, median:number}[]} [flags]
     */
    mark(errors, flags = []) {
      marks = new Map();
      for (const e of errors) {
        const field = e.field === 'kwRange' ? 'kwMin' : e.field;
        const row = ['site', 'fixed', 'addOns', 'terms'].includes(e.section) ? 0 : e.row ?? 0;
        marks.set(`${e.section}:${row}:${field}`, { msg: e.message, kind: 'error' });
      }
      for (const f of flags) {
        const k = `packages:${f.packageIndex}:rate_${f.slab}`;
        if (!marks.has(k)) marks.set(k, { msg: `${f.deviationPct > 0 ? '+' : ''}${f.deviationPct}% vs city median ₹${f.median.toLocaleString('en-IN')}`, kind: 'flag' });
      }
      // re-index packages so row numbers match the collected order, then repaint
      tables.packages.getRows().forEach((/** @type {any} */ r, /** @type {number} */ i) => { r.getData()._i = i; });
      all.forEach((t) => t.redraw(true));
    },
    destroy() { all.forEach((t) => t.destroy()); },
  };
}
