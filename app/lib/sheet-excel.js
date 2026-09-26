// @ts-check
/**
 * Price sheet <-> Excel workbook (SheetJS). One worksheet per section.
 * Column / key names match the validator's field names, so validation errors map straight to cells.
 */
import { SLABS } from '../../engine/estimate.js';

const ROOFS = ['rcc', 'sheet', 'tile'];
const STRUCTS = ['standard', 'elevated_6ft', 'elevated_10ft'];
const PKG_COLS = ['id', 'name', 'tier', 'dcr', 'panelId', 'inverterId', ...SLABS.map((s) => `rate_${s}`)];

const loadXlsx = () => import('xlsx');

/** Key/value rows for the simple sections. @param {any} s */
export function kvSections(s) {
  return {
    Site: [['perFloorAbove2', s.site.perFloorAbove2], ['freeRadiusKm', s.site.freeRadiusKm], ['perKmBeyond', s.site.perKmBeyond]],
    Fixed: [['netMeterFee', s.fixed.netMeterFee], ['paperwork', s.fixed.paperwork], ['transport', s.fixed.transport]],
    AddOns: [['batteryPerKwh', s.addOns.batteryPerKwh], ...Object.entries(s.addOns.evCharger || {}).map(([k, v]) => [`ev_${k}`, v]),
      ['monitoring', s.addOns.monitoring], ['amcPerYear', s.addOns.amcPerYear]],
    Terms: [['workmanshipWarrantyYears', s.terms.workmanshipWarrantyYears], ['paymentMilestones', s.terms.paymentMilestones],
      ['validUntil', String(s.terms.validUntil).slice(0, 10)], ['tolerancePct', s.terms.tolerancePct],
      ['kwMin', s.kwRange[0]], ['kwMax', s.kwRange[1]], ['servicePincodes', s.servicePincodes.join(', ')]],
  };
}

/** Build and download an .xlsx for a sheet. @param {any} s @param {string} filename */
export async function downloadSheet(s, filename) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const pk = [PKG_COLS, ...s.packages.map((/** @type {any} */ p) => [p.id, p.name, p.tier, p.dcr ? 'yes' : 'no', p.panelId, p.inverterId, ...SLABS.map((sl) => p.ratesPerKw[sl])])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pk), 'Packages');
  const st = [['roofType', ...STRUCTS], ...ROOFS.map((r) => [r, ...STRUCTS.map((x) => s.structure[r][x])])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st), 'Structure');
  for (const [name, rows] of Object.entries(kvSections(s))) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['field', 'value'], ...rows]), name);
  }
  XLSX.writeFile(wb, filename);
}

/** @param {any} v */
const n = (v) => (v === '' || v == null ? NaN : Number(String(v).replace(/[,₹\s]/g, '')));
/** @param {any} v */
const yes = (v) => ['yes', 'y', 'true', '1', 'dcr'].includes(String(v).trim().toLowerCase());

/** Excel date cells arrive as serial numbers. @param {any} v */
function toIsoDate(v) {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  return String(v ?? '').trim();
}

/**
 * Parse an uploaded workbook into a sheet. Missing tabs keep values from `base`.
 * @param {File|ArrayBuffer} file @param {any} base current sheet (for defaults)
 * @returns {Promise<{sheet:any, problems:string[]}>}
 */
export async function parseWorkbook(file, base) {
  const XLSX = await loadXlsx();
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const s = structuredClone(base);
  /** @type {string[]} */
  const problems = [];
  const rows = (/** @type {string} */ name) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) : null;

  const pk = /** @type {any[]|null} */ (rows('Packages'));
  if (pk) {
    s.packages = pk.filter((r) => String(r.id || r.name).trim()).map((r) => ({
      id: String(r.id).trim(), name: String(r.name).trim(), tier: String(r.tier).trim().toLowerCase(), dcr: yes(r.dcr),
      panelId: String(r.panelId).trim(), inverterId: String(r.inverterId).trim(),
      ratesPerKw: Object.fromEntries(SLABS.map((sl) => [sl, n(r[`rate_${sl}`])])),
    }));
  } else problems.push('Missing "Packages" tab — kept current packages');

  const st = /** @type {any[]|null} */ (rows('Structure'));
  if (st) for (const r of st) {
    const rt = String(r.roofType).trim().toLowerCase();
    if (ROOFS.includes(rt)) for (const x of STRUCTS) s.structure[rt][x] = n(r[x]);
  }
  /** @param {string} tab */
  const kv = (tab) => {
    const r = /** @type {any[]|null} */ (rows(tab));
    if (!r) { problems.push(`Missing "${tab}" tab — kept current values`); return null; }
    return Object.fromEntries(r.map((x) => [String(x.field).trim(), x.value]));
  };
  const site = kv('Site');
  if (site) for (const f of ['perFloorAbove2', 'freeRadiusKm', 'perKmBeyond']) s.site[f] = n(site[f]);
  const fixed = kv('Fixed');
  if (fixed) for (const f of ['netMeterFee', 'paperwork', 'transport']) s.fixed[f] = n(fixed[f]);
  const add = kv('AddOns');
  if (add) {
    for (const f of ['batteryPerKwh', 'monitoring', 'amcPerYear']) s.addOns[f] = n(add[f]);
    s.addOns.evCharger = Object.fromEntries(Object.entries(add).filter(([k]) => k.startsWith('ev_')).map(([k, v]) => [k.slice(3), n(v)]));
  }
  const t = kv('Terms');
  if (t) {
    s.terms.workmanshipWarrantyYears = n(t.workmanshipWarrantyYears);
    s.terms.paymentMilestones = String(t.paymentMilestones ?? '');
    s.terms.validUntil = toIsoDate(t.validUntil);
    s.terms.tolerancePct = n(t.tolerancePct);
    s.kwRange = [n(t.kwMin), n(t.kwMax)];
    s.servicePincodes = String(t.servicePincodes ?? '').split(/[,\s]+/).filter(Boolean);
  }
  return { sheet: s, problems };
}

/**
 * Human-readable Excel location for a validation error.
 * @param {{section:string,row:number|null,field:string}} e
 */
export function excelCell(e) {
  const col = (/** @type {number} */ i) => String.fromCharCode(65 + i);
  if (e.section === 'packages') return e.row == null ? 'Packages' : `Packages!${col(Math.max(0, PKG_COLS.indexOf(e.field)))}${e.row + 2}`;
  if (e.section === 'structure') return `Structure!${col(STRUCTS.indexOf(e.field) + 1)}${(e.row ?? 0) + 2}`;
  const tab = { site: 'Site', fixed: 'Fixed', addOns: 'AddOns', terms: 'Terms' }[/** @type {'site'} */ (e.section)] || e.section;
  return `${tab} → ${e.field}`;
}
