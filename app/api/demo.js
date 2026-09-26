// @ts-check
/** Demo helpers: reset, clock, demo customer. Not part of the future server API. */
import { seed, now, advanceClock, delay, table } from './store.js';
import { verifyOtp, updateCustomer, DEMO_OTP } from './auth.js';

export const DEMO_PHONE = '9876543210';
export const DEMO_CONFIG = {
  pincode: '560102',
  roofAreaSqm: 60,
  roofType: 'rcc',
  floors: 2,
  structure: 'standard',
  monthlyUnits: 450,
  sanctionedLoadKw: 5,
  prefs: { subsidy: true, tier: 'standard', battery: 0, evCharger: 7.4, finance: false },
};
export const DEMO_CUSTOMER = { name: 'Asha Demo', address: '42, 17th Cross, Sector 4, HSR Layout, Bengaluru' };

export async function resetDemo() {
  await delay(0);
  seed();
}

export function getClock() {
  return now();
}

/** @param {number} days */
export async function advanceTime(days) {
  await delay(0);
  advanceClock(days);
  return now();
}

/** Sign in the demo customer with the fixed OTP and fill their details. */
export async function signInDemoCustomer() {
  const r = await verifyOtp(DEMO_PHONE, DEMO_OTP);
  await updateCustomer(DEMO_CUSTOMER);
  return r;
}

/** Leads for the drawer's "advance time" list (any customer). */
export async function listActiveLeads() {
  await delay(0);
  return /** @type {any[]} */ (table('leads').all()).map((l) => ({ id: l.id, vendorName: l.vendorName, customerName: l.customerName, status: l.status })).reverse();
}
