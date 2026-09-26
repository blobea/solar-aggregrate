// @ts-check
/** "Demo controls" drawer: reset data, jump role, advance time, toggle sponsored slot. */
import Alpine from 'alpinejs';
import { demo, requests, vendors, auth, drafts } from '../api/index.js';
import { go } from '../router.js';
import { STATUS_LABELS } from '../api/requests.js';
import { dateTime } from '../lib/format.js';

const TEMPLATE = /* html */ `
<div x-data="demoDrawer" @keydown.escape.window="close()">
  <div class="backdrop" x-show="$store.app.drawerOpen" x-transition.opacity @click="close()" x-cloak></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" x-show="$store.app.drawerOpen" x-cloak
    x-effect="if ($store.app.drawerOpen) { load(); $nextTick(() => $refs.close.focus()); }">
    <div class="row-between">
      <h2 id="drawer-title" style="margin:0">Demo controls</h2>
      <button class="btn btn-sm" x-ref="close" type="button" @click="close()">Close</button>
    </div>
    <p class="muted small">Everything here is for demonstrating the prototype. Data is stored in this browser only.</p>

    <section class="stack-sm">
      <h3>Demo clock</h3>
      <p class="small">Now: <strong x-text="clock"></strong></p>
    </section>
    <hr class="divider" />

    <section class="stack-sm">
      <h3>Quick start</h3>
      <button class="btn btn-sun btn-block" type="button" data-testid="drawer-demo-customer" @click="demoCustomer()">Demo customer → results</button>
      <div class="grid-3" style="grid-template-columns:repeat(3,1fr)">
        <button class="btn btn-sm" type="button" @click="jump('customer')">Customer</button>
        <button class="btn btn-sm" type="button" @click="jump('vendor')">Vendor</button>
        <button class="btn btn-sm" type="button" @click="jump('ops')">Ops</button>
      </div>
    </section>
    <hr class="divider" />

    <section class="stack-sm">
      <h3>Advance time</h3>
      <p class="small muted">Moves a request to its next milestone (doing the vendor's step with sample values) and moves the clock forward 4 days, so 72-hour review checks complete. After installation it jumps 6 months for the long-term review.</p>
      <template x-if="!leads.length"><p class="small">No requests yet.</p></template>
      <ul class="stack-sm" style="list-style:none;padding:0;margin:0">
        <template x-for="l in leads" :key="l.id">
          <li class="card" style="padding:10px 12px">
            <div class="row-between">
              <div class="small">
                <strong x-text="l.vendorName"></strong><br />
                <span class="muted" x-text="l.customerName + ' · ' + statusLabel(l.status)"></span>
              </div>
              <button class="btn btn-sm" type="button" :data-testid="'advance-' + l.id" @click="advance(l.id)">Advance</button>
            </div>
          </li>
        </template>
      </ul>
    </section>
    <hr class="divider" />

    <section class="stack-sm">
      <h3>Sponsored slot</h3>
      <label class="check"><input type="checkbox" :checked="sponsorEnabled" @change="toggleSponsor($event.target.checked)" />
        Show the sponsored slot on results</label>
      <p class="small muted">Sponsored placement never changes organic ranking, reviews or accuracy.</p>
    </section>
    <hr class="divider" />

    <section class="stack-sm">
      <h3>Reset</h3>
      <button class="btn btn-danger btn-block" type="button" data-testid="reset-demo" @click="reset()">Reset demo data</button>
    </section>
  </aside>
</div>`;

/** @param {HTMLElement} root */
export function mountDemoDrawer(root) {
  Alpine.data('demoDrawer', () => ({
    leads: /** @type {any[]} */ ([]),
    sponsorEnabled: true,
    clock: '',
    async load() {
      this.leads = await demo.listActiveLeads();
      this.sponsorEnabled = (await vendors.getSettings()).sponsorEnabled;
      this.clock = dateTime(demo.getClock());
    },
    close() { Alpine.store('app').drawerOpen = false; },
    /** @param {string} s */
    statusLabel: (s) => STATUS_LABELS[/** @type {keyof STATUS_LABELS} */ (s)] || s,
    async demoCustomer() {
      await demo.signInDemoCustomer();
      drafts.saveDraft({ ...drafts.emptyDraft(), step: 5, config: structuredClone(demo.DEMO_CONFIG) });
      Alpine.store('app').refreshSession();
      Alpine.store('app').results = null;
      this.close();
      go('/results');
      rerender();
    },
    /** @param {'customer'|'vendor'|'ops'} role */
    async jump(role) {
      await auth.switchRole(role);
      Alpine.store('app').refreshSession();
      this.close();
      go({ customer: '/', vendor: '/vendor', ops: '/ops' }[role]);
    },
    /** @param {string} id */
    async advance(id) {
      try {
        const l = await requests.advanceLead(id);
        Alpine.store('app').toast(`${l.vendorName}: ${this.statusLabel(l.status)}`);
        await this.load();
        rerender();
      } catch (e) {
        Alpine.store('app').toast(String(/** @type {Error} */ (e).message), 'error');
      }
    },
    /** @param {boolean} on */
    async toggleSponsor(on) {
      await vendors.updateSettings({ sponsorEnabled: on });
      this.sponsorEnabled = on;
      Alpine.store('app').results = null;
      rerender();
    },
    async reset() {
      await demo.resetDemo();
      Alpine.store('app').refreshSession();
      Alpine.store('app').results = null;
      Alpine.store('app').vendors = await vendors.listVendorNames();
      Alpine.store('app').toast('Demo data reset');
      this.close();
      go('/');
      rerender();
    },
  }));
  root.innerHTML = TEMPLATE;
}

/** Re-render the current screen so it picks up changed data. */
function rerender() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
