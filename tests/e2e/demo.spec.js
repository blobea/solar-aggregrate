// @ts-check
/**
 * Full demo path smoke test:
 * demo customer → results → compare 3 → consent → request → vendor logs final quote → advance time →
 * customer leaves a low install review with reason codes → vendor disputes → ops resolves →
 * accuracy and rating update on the vendor profile.
 */
import { test, expect } from '@playwright/test';

const INSTALL_DIMS = ['quoteAccuracy', 'timeliness', 'workmanship', 'paperwork', 'communication'];
const REASONS = { quoteAccuracy: 'price_above_estimate', timeliness: 'missed_date', workmanship: 'poor_workmanship', paperwork: 'paperwork_issue', communication: 'no_response' };

/** @param {import('@playwright/test').Page} page @param {'customer'|'vendor'|'ops'} role */
async function switchRole(page, role) {
  await page.getByTestId('role-switcher').selectOption(role);
  await expect(page.locator('.brand small')).toHaveText({ customer: 'Bengaluru', vendor: 'Vendor portal', ops: 'Ops console' }[role]);
}

/** @param {import('@playwright/test').Page} page */
async function openDrawer(page) {
  await page.getByTestId('open-demo-drawer').click();
  await expect(page.getByRole('dialog', { name: 'Demo controls' })).toBeVisible();
}

test('full demo path', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // fresh data
  await page.goto('/');
  await openDrawer(page);
  await page.getByTestId('reset-demo').click();
  await expect(page.getByRole('dialog', { name: 'Demo controls' })).toBeHidden();

  // 1. demo customer → results
  await page.getByTestId('demo-customer').click();
  await expect(page).toHaveURL(/#\/results/);
  const cards = page.getByTestId('vendor-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByTestId('sponsored-card')).toContainText('Sponsored');
  await expect(page.getByTestId('summary-kw')).toHaveText('4 kW');

  // 2. compare 3 (organic cards)
  const vendorIds = [];
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    vendorIds.push(await card.getAttribute('data-vendor'));
    await card.getByTestId('compare-toggle').click();
  }
  const vendorA = /** @type {string} */ (vendorIds[0]);
  await page.getByTestId('go-compare').click();
  await expect(page.getByTestId('compare-table').locator('thead th')).toHaveCount(4);

  // baseline metrics for vendor A
  await page.goto(`/#/vendors/${vendorA}`);
  const ratingBefore = Number(await page.getByTestId('profile-rating').textContent());
  const quoteCount = async () => Number((await page.getByTestId('profile-accuracy-count').textContent())?.replace(/\D/g, ''));
  const quotesBefore = await quoteCount();
  const vendorName = (await page.locator('h1').textContent())?.trim() || '';

  // 3. request surveys → consent (unticked by default, required)
  await page.goto('/#/compare');
  await page.getByTestId('compare-request').click();
  for (const id of vendorIds) await expect(page.getByTestId(`survey-${id}`)).toBeChecked();
  await page.getByTestId('request-continue').click();
  await expect(page.getByTestId('consent-checkbox')).not.toBeChecked();
  await page.getByTestId('consent-submit').click();
  await expect(page.getByRole('alert')).toContainText('tick the box');
  await page.getByTestId('consent-checkbox').check();
  await page.getByTestId('consent-submit').click();
  await expect(page.getByRole('heading', { name: 'Survey requests sent' })).toBeVisible();
  await page.getByTestId('go-my-requests').click();
  await expect(page.getByTestId(`request-${vendorA}`)).toContainText('Request sent');

  // 4. vendor logs a final quote well above the estimate
  await switchRole(page, 'vendor');
  await page.getByTestId('vendor-switcher').selectOption(vendorA);
  await page.goto('/#/vendor/leads');
  await page.getByTestId('lead-row').filter({ hasText: 'Asha Demo' }).click();
  const leadId = page.url().split('/').pop();
  const netText = await page.locator('tr', { hasText: 'Net shown' }).locator('td.num').textContent();
  const net = Number(String(netText).replace(/[^\d]/g, ''));
  await page.getByTestId('final-quote').fill(String(Math.round(net * 1.4)));
  await page.getByTestId('log-final-quote').click();
  await expect(page.getByTestId('lead-status')).toHaveText('Final quote received');

  // 5. advance time → installed
  await openDrawer(page);
  await page.getByTestId(`advance-${leadId}`).click();
  await expect(page.getByTestId('lead-status')).toHaveText('Installed');
  await page.keyboard.press('Escape');

  // 6. customer leaves a low installation review with reason codes
  await switchRole(page, 'customer');
  await page.goto('/#/my-requests');
  const req = page.getByTestId(`request-${vendorA}`);
  await expect(req.getByTestId('request-status')).toHaveText('Installed');
  await req.getByTestId('review-prompt-install').click();
  for (const d of INSTALL_DIMS) await page.getByTestId(`score-${d}-1`).check({ force: true });
  await page.getByTestId('submit-review').click();
  await expect(page.getByRole('alert')).toContainText('reason is required');
  for (const d of INSTALL_DIMS) await page.getByTestId(`reason-${d}`).selectOption(REASONS[/** @type {keyof REASONS} */ (d)]);
  await expect(page.getByTestId('evidence')).not.toHaveValue('');
  await page.getByTestId('review-text').fill('Final price was 40% above the estimate and the install was late.');
  await page.getByTestId('submit-review').click();
  await expect(page).toHaveURL(/#\/my-requests/);
  await expect(page.getByTestId(`request-${vendorA}`)).toContainText('Pending 72-hour check');

  // clear the 72-hour check
  await openDrawer(page);
  await page.getByTestId('skip-3-days').click();
  await page.keyboard.press('Escape');

  // 7. vendor disputes
  await switchRole(page, 'vendor');
  await page.goto('/#/vendor/reviews');
  const rev = page.getByTestId('vendor-review').filter({ hasText: 'Asha Demo' });
  await rev.getByTestId('open-dispute').click();
  await rev.getByTestId('dispute-ground').selectOption('factually_false');
  await rev.getByTestId('dispute-note').fill('Customer upgraded panels at survey; signed quote on file.');
  await rev.getByTestId('submit-dispute').click();
  await expect(rev).toContainText('is with Ops');

  // 8. ops resolves: the review stands
  await switchRole(page, 'ops');
  await page.goto('/#/ops/disputes');
  const disp = page.getByTestId('dispute').filter({ hasText: vendorName }).filter({ hasText: 'Asha Demo' });
  await disp.getByTestId('outcome-stands').check({ force: true });
  await disp.getByTestId('ops-note').fill('Signed quote shows standard panels; the final price rose without a documented reason.');
  await disp.getByTestId('resolve-dispute').click();
  await expect(page.getByTestId('dispute').filter({ hasText: 'Asha Demo' })).toHaveCount(0);

  // 9. accuracy and rating updated on the public profile
  await switchRole(page, 'customer');
  await page.goto(`/#/vendors/${vendorA}`);
  const ratingAfter = Number(await page.getByTestId('profile-rating').textContent());
  expect(ratingAfter).toBeLessThan(ratingBefore);
  // the +40% final quote is now part of the accuracy window (median of the last 20)
  await expect(page.getByTestId('profile-accuracy-count')).toBeVisible();
  expect(await quoteCount()).toBe(quotesBefore + 1);
  const review = page.getByTestId('review').filter({ hasText: 'Asha Demo' });
  await expect(review).toContainText('review stands');

  expect(errors).toEqual([]);
});
