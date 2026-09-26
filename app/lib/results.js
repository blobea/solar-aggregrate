// @ts-check
import Alpine from 'alpinejs';
import { drafts, estimates } from '../api/index.js';

/** Load (or reuse) results for the saved configuration. Shared by compare/request/consent. */
export async function currentResults() {
  const store = Alpine.store('app');
  if (store.results) return store.results;
  const d = drafts.getDraft();
  store.results = await estimates.getEstimates(d.config, { sort: /** @type {any} */ (d.sort || 'best') });
  return store.results;
}
