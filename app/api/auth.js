// @ts-check
/**
 * Hard-coded demo auth. OTP is always 123456. The demo role switcher sets the role directly.
 * Future: replace with Supabase phone auth; keep the same function names.
 */
import { kv, table, delay, newId } from './store.js';

export const DEMO_OTP = '123456';

/**
 * @typedef {Object} Session
 * @property {'customer'|'vendor'|'ops'} role
 * @property {string|null} customerId
 * @property {string|null} phone
 * @property {string|null} name
 * @property {string|null} vendorId  when role = vendor
 */

/** @returns {Session} */
export function getSession() {
  return kv.get('session') || { role: 'customer', customerId: null, phone: null, name: null, vendorId: null };
}

/** @param {Partial<Session>} patch */
function patchSession(patch) {
  const s = { ...getSession(), ...patch };
  kv.set('session', s);
  return s;
}

/** @param {string} phone */
export function normalizePhone(phone) {
  const d = String(phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
}

/** @param {string} phone */
export async function requestOtp(phone) {
  await delay();
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'Enter a valid 10-digit Indian mobile number' };
  return { ok: true, phone: p, hint: `Demo: the code is always ${DEMO_OTP}` };
}

/** @param {string} phone @param {string} code */
export async function verifyOtp(phone, code) {
  await delay();
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'Invalid phone number' };
  if (String(code).trim() !== DEMO_OTP) return { ok: false, error: 'Incorrect code. (Demo code: 123456)' };
  const customers = table('customers');
  let c = /** @type {any} */ (customers.all().find((/** @type {any} */ x) => x.phone === p));
  if (!c) c = customers.insert({ id: newId('cust'), phone: p, name: null, address: null, createdAt: new Date().toISOString() });
  return { ok: true, session: patchSession({ role: 'customer', customerId: c.id, phone: p, name: c.name }) };
}

/** @param {{name?:string, address?:string}} details */
export async function updateCustomer(details) {
  await delay(0);
  const s = getSession();
  if (!s.customerId) throw new Error('Not signed in');
  table('customers').update(s.customerId, (c) => ({ ...c, ...details }));
  return patchSession({ name: details.name ?? s.name });
}

export function currentCustomer() {
  const s = getSession();
  return s.customerId ? /** @type {any} */ (table('customers').all().find((/** @type {any} */ c) => c.id === s.customerId)) || null : null;
}

/** Demo role switcher. @param {'customer'|'vendor'|'ops'} role @param {string|null} [vendorId] */
export async function switchRole(role, vendorId = null) {
  await delay(0);
  const s = getSession();
  return patchSession({ role, vendorId: role === 'vendor' ? vendorId || s.vendorId || 'v-greengrid' : s.vendorId });
}

export async function logout() {
  await delay(0);
  return patchSession({ customerId: null, phone: null, name: null });
}
