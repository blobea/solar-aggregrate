// @ts-check
/** Screenshots of key screens at phone (390×844) and desktop (1280×800). Output: docs/screenshots/. */
import { test, expect } from '@playwright/test';

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const size of SIZES) {
  test(`screenshots ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const shot = (/** @type {string} */ name) => page.screenshot({ path: `docs/screenshots/${name}-${size.name}.png`, fullPage: false });

    await page.goto('/');
    await page.getByTestId('open-demo-drawer').click();
    await page.getByTestId('reset-demo').click();
    await page.reload();
    await expect(page.locator('h1')).toContainText('Compare rooftop solar');
    await expect(page.locator('.toast')).toHaveCount(0);
    await shot('home');

    // configurator roof step with a drawn roof
    await page.goto('/#/configure?step=1');
    await page.getByTestId('pincode').fill('560102');
    await page.getByTestId('next').click();
    const map = page.getByTestId('roof-map');
    await expect(map.locator('.leaflet-tile-pane')).toBeAttached();
    await page.waitForLoadState('networkidle').catch(() => {});
    const box = /** @type {{x:number,y:number,width:number,height:number}} */ (await map.boundingBox());
    // ~9 m × 7 m at zoom 19 (about 0.3 m per CSS pixel)
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const pts = [[-15, -12], [15, -12], [15, 12], [-15, 12]];
    for (const [dx, dy] of pts) await page.mouse.click(cx + dx, cy + dy);
    await expect(page.getByText(/Drawn area: \d+ m²/)).toBeVisible();
    await page.getByRole('button', { name: 'Use drawn area' }).click();
    await expect(page.getByTestId('roof-area')).not.toHaveValue('');
    await map.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, (document.querySelector('[data-testid="roof-map"]')?.getBoundingClientRect().top ?? 0) + window.scrollY - 140));
    await shot('configurator-roof');

    // results via demo customer
    await page.goto('/');
    await page.getByTestId('demo-customer').click();
    await expect(page.getByTestId('vendor-card').first()).toBeVisible();
    await page.waitForTimeout(300);
    await shot('results');
    await page.getByTestId('sponsored-card').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await shot('results-cards');

    const cards = page.getByTestId('vendor-card');
    for (let i = 0; i < 3; i++) await cards.nth(i).getByTestId('compare-toggle').click();
    await page.getByTestId('go-compare').click();
    await expect(page.getByTestId('compare-table')).toBeVisible();
    await shot('comparison');

    await page.getByTestId('role-switcher').selectOption('vendor');
    await page.goto('/#/vendor/sheet');
    await expect(page.getByTestId('grid-packages').locator('.tabulator-row').first()).toBeVisible();
    await shot('vendor-price-sheet');

    await page.getByTestId('role-switcher').selectOption('ops');
    await page.goto('/#/ops/disputes');
    await expect(page.getByTestId('dispute').first()).toBeVisible();
    await shot('ops-disputes');
  });
}
