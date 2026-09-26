import { chromium } from '@playwright/test';
const base = 'http://localhost:5173/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
await p.goto(base);
await p.getByTestId('demo-customer').click();
await p.waitForTimeout(800);
const routes = ['/', '/configure?step=1', '/configure?step=2', '/configure?step=3', '/configure?step=4', '/configure?step=5', '/results', '/compare', '/request', '/consent', '/my-requests', '/vendors/v-nimbus', '/how-we-rank', '/review-policy',
  '/vendor', '/vendor/leads', '/vendor/sheet', '/vendor/availability', '/vendor/reviews', '/ops', '/ops/import', '/ops/disputes', '/ops/rules', '/ops/estimates'];
for (const r of routes) {
  await p.goto(base + '#' + r);
  await p.waitForTimeout(700);
  const w = await p.evaluate(() => {
    const over = [...document.querySelectorAll('body *')].filter((el) => {
      const rc = el.getBoundingClientRect();
      if (rc.right <= 361) return false;
      // ignore content inside intentional horizontal scrollers
      for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a).overflowX; if (s === 'auto' || s === 'scroll' || s === 'hidden') return false; }
      return true;
    }).slice(0, 3).map((el) => el.tagName + '.' + el.className);
    return { sw: document.documentElement.scrollWidth, over };
  });
  console.log(r.padEnd(22), w.sw, w.over.join(' | '));
}
await b.close();

