// @ts-check
import Alpine from 'alpinejs';
import template from './screen.html?raw';
import { sheets, catalogue } from '../../api/index.js';

export { template };

export default function vendorAvailability() {
  const vendorId = Alpine.store('app').session.vendorId;
  return {
    groups: /** @type {any[]} */ ([]),
    av: /** @type {Record<string, {status:string, leadTimeDays:number}>} */ ({}),
    dirty: false,
    async init() {
      const [cat, sheet] = await Promise.all([catalogue.getCatalogue(), sheets.getPriceSheet(vendorId)]);
      const all = [...cat.panels, ...cat.inverters, ...cat.batteries, ...cat.evChargers];
      this.av = Object.fromEntries(all.map((i) => [i.id, { status: 'in_stock', leadTimeDays: 7, ...(sheet.availability?.[i.id] || {}) }]));
      this.groups = [
        { key: 'panels', label: 'Panels', items: cat.panels.map((/** @type {any} */ p) => ({ ...p, detail: `${p.wp} Wp · ${p.technology} · ${p.dcr ? 'DCR' : 'non-DCR'}` })) },
        { key: 'inverters', label: 'Inverters', items: cat.inverters.map((/** @type {any} */ p) => ({ ...p, detail: `${p.type} · ${p.kwMin}–${p.kwMax} kW` })) },
        { key: 'batteries', label: 'Batteries', items: cat.batteries.map((/** @type {any} */ p) => ({ ...p, detail: `${p.kwh} kWh · ${p.chemistry}` })) },
        { key: 'ev', label: 'EV chargers', items: cat.evChargers.map((/** @type {any} */ p) => ({ ...p, detail: `${p.kw} kW` })) },
      ];
    },
    async save() {
      const r = await sheets.updateAvailability(vendorId, JSON.parse(JSON.stringify(this.av)));
      if (!r.ok) { Alpine.store('app').toast(r.errors[0]?.message || 'Could not save', 'error'); return; }
      this.dirty = false;
      Alpine.store('app').toast(`Availability saved (sheet v${r.sheet.version})`);
    },
  };
}
