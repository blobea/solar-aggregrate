// @ts-check
/**
 * Shared JSDoc types for the pricing engine. No runtime code.
 * The engine is pure: no DOM, no storage, no clock (callers pass `now`).
 */

/**
 * @typedef {'rcc'|'sheet'|'tile'} RoofType
 * @typedef {'standard'|'elevated_6ft'|'elevated_10ft'} StructureType
 * @typedef {'economy'|'standard'|'premium'} Tier
 *
 * @typedef {Object} Prefs
 * @property {boolean} subsidy
 * @property {Tier} tier
 * @property {0|5|10} battery      kWh
 * @property {0|3.3|7.4} evCharger kW
 * @property {boolean} finance
 *
 * @typedef {Object} Config
 * @property {string} pincode
 * @property {number} roofAreaSqm
 * @property {RoofType} roofType
 * @property {number} floors
 * @property {StructureType} structure
 * @property {number} monthlyUnits
 * @property {number} sanctionedLoadKw
 * @property {number} [kw]          user override of recommended kW
 * @property {Prefs} prefs
 *
 * @typedef {Object} Package
 * @property {string} id
 * @property {string} name
 * @property {Tier} tier
 * @property {boolean} dcr
 * @property {string} panelId
 * @property {string} inverterId
 * @property {Record<string, number>} ratesPerKw  keys "1-3","3-5","5-10","10-25"
 *
 * @typedef {Object} PriceSheet
 * @property {string} vendorId
 * @property {number} version
 * @property {string} updatedAt   ISO date
 * @property {Package[]} packages
 * @property {Record<RoofType, Record<StructureType, number>>} structure  ₹/kW
 * @property {{perFloorAbove2:number, freeRadiusKm:number, perKmBeyond:number}} site
 * @property {{netMeterFee:number, paperwork:number, transport:number}} fixed
 * @property {{batteryPerKwh:number, evCharger:Record<string, number>, monitoring:number, amcPerYear:number}} addOns
 * @property {{workmanshipWarrantyYears:number, paymentMilestones:string, validUntil:string, tolerancePct:number}} terms
 * @property {Record<string, {status:'in_stock'|'on_order'|'unavailable', leadTimeDays:number}>} availability
 * @property {string[]} servicePincodes
 * @property {[number, number]} kwRange
 *
 * @typedef {Object} TariffSlab
 * @property {number|null} upTo   inclusive upper bound in units; null = no limit
 * @property {number} rate        ₹/unit
 *
 * @typedef {Object} CityRules
 * @property {string} city
 * @property {number} yieldPerKwDay
 * @property {number} areaPerKwSqm
 * @property {number} minKw
 * @property {{slabs:TariffSlab[], fixedChargePerKw:number, exportRate:number}} tariff
 * @property {{perKwFirst2:number, thirdKw:number, cap:number, requiresDcr:boolean}} subsidy
 * @property {number} degradationPct
 * @property {number} lifetimeYears
 * @property {{pincode:string, area:string, lat:number, lng:number}[]} pincodes
 *
 * @typedef {Object} LineItem
 * @property {string} code
 * @property {string} label
 * @property {number} amount
 *
 * @typedef {Object} Estimate
 * @property {boolean} eligible
 * @property {string[]} reasons     why ineligible (empty when eligible)
 * @property {string} vendorId
 * @property {string} [packageId]
 * @property {number} [kw]
 * @property {number} [gross]
 * @property {number} [subsidy]
 * @property {number} [net]
 * @property {number} [low]
 * @property {number} [high]
 * @property {LineItem[]} [lineItems]
 * @property {string[]} [warnings]
 * @property {boolean} [stale]
 * @property {number} [leadTimeDays]
 */

export {};
