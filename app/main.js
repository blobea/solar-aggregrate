// @ts-check
import Alpine from 'alpinejs';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { initApi, auth, vendors } from './api/index.js';
import { startRouter, go } from './router.js';
import { mountDemoDrawer } from './components/demo-drawer.js';

initApi();

const NAV = {
  customer: [
    { href: '#/', label: 'Home', match: /^\/$/ },
    { href: '#/configure', label: 'Get estimates', match: /^\/(configure|results|compare|request|consent)/ },
    { href: '#/my-requests', label: 'My requests', match: /^\/(my-requests|review|requested)/ },
    { href: '#/how-we-rank', label: 'How we rank', match: /^\/how-we-rank/ },
  ],
  vendor: [
    { href: '#/vendor', label: 'Dashboard', match: /^\/vendor$/ },
    { href: '#/vendor/leads', label: 'Leads', match: /^\/vendor\/leads/ },
    { href: '#/vendor/sheet', label: 'Price sheet', match: /^\/vendor\/sheet/ },
    { href: '#/vendor/availability', label: 'Availability', match: /^\/vendor\/availability/ },
    { href: '#/vendor/reviews', label: 'Reviews', match: /^\/vendor\/reviews/ },
  ],
  ops: [
    { href: '#/ops', label: 'Vendors', match: /^\/ops$/ },
    { href: '#/ops/import', label: 'Import', match: /^\/ops\/import/ },
    { href: '#/ops/disputes', label: 'Disputes', match: /^\/ops\/disputes/ },
    { href: '#/ops/rules', label: 'City rules', match: /^\/ops\/rules/ },
    { href: '#/ops/estimates', label: 'Estimates log', match: /^\/ops\/estimates/ },
  ],
};
const HOME = { customer: '/', vendor: '/vendor', ops: '/ops' };

Alpine.store('app', {
  session: auth.getSession(),
  vendors: /** @type {{id:string,name:string}[]} */ ([]),
  toasts: /** @type {{id:number,message:string,type:string}[]} */ ([]),
  drawerOpen: false,
  route: /** @type {any} */ (null),
  path: '/',
  /** Cached results for the current configuration (not persisted). */
  results: /** @type {any} */ (null),
  /** @param {string} message @param {'info'|'error'} [type] */
  toast(message, type = 'info') {
    const id = Date.now() + Math.random();
    this.toasts.push({ id, message, type });
    setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, 3500);
  },
  refreshSession() {
    this.session = auth.getSession();
  },
});

Alpine.data('shell', () => ({
  /** @param {'customer'|'vendor'|'ops'} role */
  async switchRole(role) {
    await auth.switchRole(role);
    Alpine.store('app').refreshSession();
    go(HOME[role]);
  },
  /** @param {string} id */
  async switchVendor(id) {
    await auth.switchRole('vendor', id);
    Alpine.store('app').refreshSession();
    const h = location.hash;
    go('/vendor');
    if (h === '#/vendor') window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  nav() {
    return NAV[/** @type {'customer'} */ (Alpine.store('app').session.role)] || NAV.customer;
  },
  /** @param {{match:RegExp}} item */
  isActive(item) {
    return item.match.test(Alpine.store('app').path);
  },
  homeHref() {
    return `#${HOME[/** @type {'customer'} */ (Alpine.store('app').session.role)]}`;
  },
  roleLabel() {
    const s = Alpine.store('app').session;
    if (s.role === 'vendor') return 'Vendor portal';
    if (s.role === 'ops') return 'Ops console';
    return 'Bengaluru';
  },
}));

window.Alpine = Alpine;
Alpine.start();

vendors.listVendorNames().then((v) => { Alpine.store('app').vendors = v; });
mountDemoDrawer(/** @type {HTMLElement} */ (document.getElementById('drawer-root')));

startRouter(/** @type {HTMLElement} */ (document.getElementById('view')), async (route) => {
  const store = Alpine.store('app');
  store.path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  // Demo convenience: visiting a screen of another role switches the demo role.
  if (store.session.role !== route.role) {
    await auth.switchRole(route.role);
    store.refreshSession();
  }
});
