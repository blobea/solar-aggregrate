// @ts-check
/**
 * Hash router. Each route lazily loads /screens/<name>/screen.js which exports:
 *   - `template`: the screen.html string
 *   - default: (params, query) => Alpine component object
 * The router wraps the template in a fresh x-data component and lets Alpine initialise it.
 */
import Alpine from 'alpinejs';

/** @typedef {{pattern: string, screen: string, role: 'customer'|'vendor'|'ops', title: string}} Route */

/** @type {Route[]} */
export const ROUTES = [
  { pattern: '/', screen: 'home', role: 'customer', title: 'Compare rooftop solar' },
  { pattern: '/configure', screen: 'configurator', role: 'customer', title: 'Configure your home' },
  { pattern: '/results', screen: 'results', role: 'customer', title: 'Your estimates' },
  { pattern: '/compare', screen: 'compare', role: 'customer', title: 'Compare vendors' },
  { pattern: '/request', screen: 'request', role: 'customer', title: 'Request site surveys' },
  { pattern: '/consent', screen: 'consent', role: 'customer', title: 'Share your details' },
  { pattern: '/requested/:requestId', screen: 'requested', role: 'customer', title: 'Requests sent' },
  { pattern: '/my-requests', screen: 'my-requests', role: 'customer', title: 'My requests' },
  { pattern: '/review/:leadId/:milestone', screen: 'review-form', role: 'customer', title: 'Leave a review' },
  { pattern: '/vendors/:id', screen: 'vendor-profile', role: 'customer', title: 'Vendor profile' },
  { pattern: '/how-we-rank', screen: 'how-we-rank', role: 'customer', title: 'How we rank' },
  { pattern: '/review-policy', screen: 'review-policy', role: 'customer', title: 'Review policy' },
  { pattern: '/vendor', screen: 'vendor-dashboard', role: 'vendor', title: 'Vendor dashboard' },
  { pattern: '/vendor/leads', screen: 'vendor-leads', role: 'vendor', title: 'Leads' },
  { pattern: '/vendor/leads/:id', screen: 'vendor-lead', role: 'vendor', title: 'Lead' },
  { pattern: '/vendor/sheet', screen: 'vendor-sheet', role: 'vendor', title: 'Price sheet' },
  { pattern: '/vendor/availability', screen: 'vendor-availability', role: 'vendor', title: 'Availability' },
  { pattern: '/vendor/reviews', screen: 'vendor-reviews', role: 'vendor', title: 'Reviews' },
  { pattern: '/ops', screen: 'ops-vendors', role: 'ops', title: 'Vendors' },
  { pattern: '/ops/import', screen: 'ops-import', role: 'ops', title: 'Import price sheet' },
  { pattern: '/ops/disputes', screen: 'ops-disputes', role: 'ops', title: 'Disputes' },
  { pattern: '/ops/rules', screen: 'ops-rules', role: 'ops', title: 'City rules' },
  { pattern: '/ops/estimates', screen: 'ops-estimates', role: 'ops', title: 'Estimates log' },
];

// Vite needs statically analysable globs for lazy screen chunks.
const loaders = import.meta.glob('./screens/*/screen.js');

/** @param {string} hash */
export function parseHash(hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path: path || '/', query };
}

/** @param {string} path */
export function matchRoute(path) {
  const parts = path.split('/').filter(Boolean);
  for (const r of ROUTES) {
    const rp = r.pattern.split('/').filter(Boolean);
    if (rp.length !== parts.length) continue;
    /** @type {Record<string,string>} */
    const params = {};
    let ok = true;
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith(':')) params[rp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (rp[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

/** @param {string} to e.g. "/results" */
export function go(to) {
  location.hash = `#${to}`;
}

let renderSeq = 0;

/**
 * @param {HTMLElement} view
 * @param {(route: Route) => Promise<void>} beforeRender  e.g. switch role to match the route
 */
export function startRouter(view, beforeRender) {
  const render = async () => {
    const seq = ++renderSeq;
    const { path, query } = parseHash(location.hash);
    const m = matchRoute(path) || matchRoute('/');
    if (!m) return;
    await beforeRender(m.route);
    const load = loaders[`./screens/${m.route.screen}/screen.js`];
    /** @type {any} */
    const mod = await load();
    if (seq !== renderSeq) return; // a newer navigation won
    const name = `screen_${seq}`;
    Alpine.data(name, () => mod.default(m.params, query));
    view.innerHTML = `<div x-data="${name}" data-screen="${m.route.screen}">${mod.template}</div>`;
    document.title = `${m.route.title} · SolarSaral (demo)`;
    window.scrollTo(0, 0);
    Alpine.store('app').route = m.route;
    requestAnimationFrame(() => {
      const h = /** @type {HTMLElement|null} */ (view.querySelector('h1'));
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    });
  };
  window.addEventListener('hashchange', render);
  return render();
}
