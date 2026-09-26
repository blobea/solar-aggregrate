// @ts-check
/** Small, hand-checkable fixtures for engine tests. */

/** @returns {import('./types.js').CityRules} */
export function rules() {
  return {
    city: 'Bangalore',
    yieldPerKwDay: 4.2,
    areaPerKwSqm: 6.5,
    minKw: 1,
    tariff: {
      slabs: [
        { upTo: 200, rate: 5.9 },
        { upTo: 500, rate: 7.2 },
        { upTo: null, rate: 7.85 },
      ],
      fixedChargePerKw: 120,
      exportRate: 3.8,
    },
    subsidy: { perKwFirst2: 30000, thirdKw: 18000, cap: 78000, requiresDcr: true },
    degradationPct: 0.5,
    lifetimeYears: 25,
    pincodes: [
      { pincode: '560102', area: 'HSR Layout', lat: 12.9116, lng: 77.6389 },
      { pincode: '560034', area: 'Koramangala', lat: 12.9352, lng: 77.6245 },
      { pincode: '560064', area: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
    ],
  };
}

/** @returns {import('./types.js').PriceSheet} */
export function sheet(overrides = {}) {
  return {
    vendorId: 'v1',
    version: 1,
    updatedAt: '2026-09-01',
    packages: [
      { id: 'p-std-dcr', name: 'Standard DCR', tier: 'standard', dcr: true, panelId: 'pn1', inverterId: 'inv1', ratesPerKw: { '1-3': 50000, '3-5': 46000, '5-10': 43000, '10-25': 40000 } },
      { id: 'p-std-ndcr', name: 'Standard non-DCR', tier: 'standard', dcr: false, panelId: 'pn2', inverterId: 'inv1', ratesPerKw: { '1-3': 42000, '3-5': 39000, '5-10': 37000, '10-25': 35000 } },
      { id: 'p-std-hyb', name: 'Standard hybrid', tier: 'standard', dcr: true, panelId: 'pn1', inverterId: 'inv2', ratesPerKw: { '1-3': 58000, '3-5': 54000, '5-10': 51000, '10-25': 48000 } },
    ],
    structure: {
      rcc: { standard: 3000, elevated_6ft: 7000, elevated_10ft: 10000 },
      sheet: { standard: 2000, elevated_6ft: 6000, elevated_10ft: 9000 },
      tile: { standard: 4000, elevated_6ft: 8000, elevated_10ft: 11000 },
    },
    site: { perFloorAbove2: 2500, freeRadiusKm: 15, perKmBeyond: 50 },
    fixed: { netMeterFee: 6000, paperwork: 3000, transport: 2000 },
    addOns: { batteryPerKwh: 30000, evCharger: { '3.3': 30000, '7.4': 55000 }, monitoring: 3000, amcPerYear: 4000 },
    terms: { workmanshipWarrantyYears: 5, paymentMilestones: '30/60/10', validUntil: '2026-12-31', tolerancePct: 10 },
    availability: {
      pn1: { status: 'in_stock', leadTimeDays: 5 },
      pn2: { status: 'in_stock', leadTimeDays: 3 },
      inv1: { status: 'in_stock', leadTimeDays: 7 },
      inv2: { status: 'on_order', leadTimeDays: 21 },
    },
    servicePincodes: ['560102', '560034'],
    kwRange: [1, 10],
    ...overrides,
  };
}

/** @returns {import('./types.js').Config} */
export function config(over = {}, prefs = {}) {
  return {
    pincode: '560102',
    roofAreaSqm: 60,
    roofType: 'rcc',
    floors: 2,
    structure: 'standard',
    monthlyUnits: 450,
    sanctionedLoadKw: 5,
    prefs: { subsidy: true, tier: 'standard', battery: 0, evCharger: 0, finance: false, ...prefs },
    ...over,
  };
}

export const catalogue = { inverters: [{ id: 'inv1', type: 'string' }, { id: 'inv2', type: 'hybrid' }], batteries: [{ id: 'b5', kwh: 5 }] };
export const vendor = { id: 'v1', basePincode: '560034' };
export const NOW = new Date('2026-09-26T10:00:00Z');
