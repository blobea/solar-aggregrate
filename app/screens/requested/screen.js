// @ts-check
import template from './screen.html?raw';
import { requests } from '../../api/index.js';
import { inr, lakhRange } from '../../lib/format.js';

export { template };

/** @param {{requestId: string}} params */
export default function requested(params) {
  return {
    leads: /** @type {any[]} */ ([]),
    inr, lakhRange,
    async init() {
      this.leads = (await requests.listMyRequests()).filter((l) => l.requestId === params.requestId);
    },
  };
}
