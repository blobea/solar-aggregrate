// Dev helper: screenshot hash routes against a running dev server and print console errors.
// Usage: node tests/e2e/helpers/shoot.mjs <outDir> <width> <route> [route...]
// A route of "demo" signs in the demo customer (via the home button) before continuing.
import { chromium } from '@playwright/test';

const [outDir, width, ...routes] = process.argv.slice(2);
const base = process.env.BASE_URL || 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: width < 600 ? 844 : 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base);
await page.waitForTimeout(400);
for (const r of routes) {
  if (r === 'demo') {
    await page.goto(base + '#/');
    await page.getByTestId('demo-customer').click();
    await page.waitForTimeout(800);
    continue;
  }
  if (r.startsWith('click:')) { await page.locator(r.slice(6)).first().click(); await page.waitForTimeout(500); continue; }
  await page.goto(base + '#' + r);
  await page.waitForTimeout(900);
  const name = r.replace(/[^a-z0-9]+/gi, '_') || 'home';
  await page.screenshot({ path: `${outDir}/${name}_${width}.png`, fullPage: true });
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
