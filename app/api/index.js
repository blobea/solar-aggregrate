// @ts-check
/**
 * Single entry point for the mock API. Screens import from here only.
 * Importing every module here guarantees seed hooks are registered before the first seed.
 */
import { ensureSeeded } from './store.js';
export * as auth from './auth.js';
export * as catalogue from './catalogue.js';
export * as estimates from './estimates.js';
export * as requests from './requests.js';
export * as reviews from './reviews.js';
export * as vendors from './vendors.js';
export * as sheets from './price-sheets.js';
export * as demo from './demo.js';
import './requests.js';

export function initApi() {
  ensureSeeded();
}
