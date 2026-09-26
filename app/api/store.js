// @ts-check
/**
 * Tiny table store over localStorage. The only module that touches storage.
 * Swap this (and nothing in the screens) for Supabase later: every other api/*.js file
 * goes through `table()`, `now()` and `delay()`.
 */
import catalogue from '../../data/seed/catalogue.json';
import cityRules from '../../data/seed/city-rules.json';
import vendors from '../../data/seed/vendors.json';
import priceSheets from '../../data/seed/price-sheets.json';
import reviews from '../../data/seed/reviews.json';
import finalQuotes from '../../data/seed/final-quotes.json';
import requests from '../../data/seed/requests.json';
import { resolveSeedDates } from './seed-dates.js';

const NS = 'solar-demo:v1:';
const LATENCY_MS = 40;

/** In-memory fallback when localStorage is unavailable (private mode etc.). */
/** @type {Record<string, string>} */
const memory = {};
const ls = {
  /** @param {string} k */
  get: (k) => { try { return localStorage.getItem(NS + k); } catch { return memory[k] ?? null; } },
  /** @param {string} k @param {string} v */
  set: (k, v) => { try { localStorage.setItem(NS + k, v); } catch { memory[k] = v; } },
  clear: () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k)); } catch { /* noop */ }
    for (const k of Object.keys(memory)) delete memory[k];
  },
};

/** Demo clock: real time plus an offset the demo drawer can advance. */
export function now() {
  return Date.now() + Number(ls.get('clockOffset') || 0);
}
/** @param {number} days */
export function advanceClock(days) {
  ls.set('clockOffset', String(Number(ls.get('clockOffset') || 0) + days * 86_400_000));
}
export const nowIso = () => new Date(now()).toISOString();

/** @param {number} [ms] */
export const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

/** @param {string} prefix */
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Deep clone so callers can never mutate stored rows by reference. @template T @param {T} v @returns {T} */
export const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/**
 * @template T
 * @param {string} name
 */
export function table(name) {
  return {
    /** @returns {T[]} */
    all: () => JSON.parse(ls.get(name) || '[]'),
    /** @param {T[]} rows */
    save: (rows) => ls.set(name, JSON.stringify(rows)),
    /** @param {T} row */
    insert(row) { const rows = this.all(); rows.push(row); this.save(rows); return row; },
    /** @param {string} id @param {(row: any) => any} fn */
    update(id, fn) {
      const rows = this.all();
      const i = rows.findIndex((/** @type {any} */ r) => r.id === id);
      if (i < 0) throw new Error(`${name}: ${id} not found`);
      rows[i] = fn(clone(rows[i]));
      this.save(rows);
      return rows[i];
    },
  };
}

/** Singleton documents (city rules, catalogue, settings). */
export const doc = {
  /** @param {string} name */
  get: (name) => JSON.parse(ls.get(name) || 'null'),
  /** @param {string} name @param {any} value */
  set: (name, value) => ls.set(name, JSON.stringify(value)),
};

/** @type {(() => void)[]} */
const seedHooks = [];
/** Register work to run after the raw seed is loaded (e.g. computing estimates for seeded leads). */
export const onSeed = (/** @type {() => void} */ fn) => seedHooks.push(fn);

export function isSeeded() {
  return ls.get('seeded') === '1';
}

/** Load seed JSON into storage (resolving relative dates). */
export function seed() {
  ls.clear();
  const t = Date.now();
  doc.set('catalogue', catalogue);
  doc.set('cityRules', cityRules);
  doc.set('settings', { sponsorEnabled: true });
  table('vendors').save(resolveSeedDates(vendors, t));
  table('priceSheets').save(resolveSeedDates(priceSheets, t));
  table('reviews').save(resolveSeedDates(reviews, t));
  table('finalQuotes').save(resolveSeedDates(finalQuotes, t));
  table('seedRequests').save(resolveSeedDates(requests, t));
  table('leads').save([]);
  table('estimatesLog').save([]);
  table('customers').save([]);
  ls.set('seeded', '1');
  seedHooks.forEach((fn) => fn());
}

export function ensureSeeded() {
  if (!isSeeded()) seed();
}

/** Session and small UI prefs live outside tables. */
export const kv = {
  /** @param {string} k */
  get: (k) => JSON.parse(ls.get(k) || 'null'),
  /** @param {string} k @param {any} v */
  set: (k, v) => ls.set(k, JSON.stringify(v)),
};
