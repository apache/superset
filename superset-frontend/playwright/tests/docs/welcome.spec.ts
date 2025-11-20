// @ts-check
import { test, expect } from '@playwright/test';

test('test navigation to welcome page', async ({ page }) => {
    await page.goto('/login/');
    await page.locator('[data-test="username-input"]').fill('admin');
    await page.locator('[data-test="password-input"]').fill('admin');
    await page.locator('[data-test="login-button"]').click();

    // wait until redirected to any /superset/ URL
    await page.waitForURL(/.*superset\/.*/);
    await expect(page.getByText('Home')).toBeVisible();
});

test('basic test', async ({ page }) => {

      await page.goto('http://localhost:8088/login/');
    await page.locator('[data-test="username-input"]').fill('admin');
    await page.locator('[data-test="password-input"]').fill('admin');
    await page.locator('[data-test="login-button"]').click();
    await page.waitForURL(/.*superset\/.*/);
  await page.goto('http://localhost:8088/chart/add');
//   await expect(page.getByText('Choose chart type')).toBeVisible();
await page.waitForLoadState('networkidle');
  await (page.locator('.viz-gallery')).screenshot({ path: './Screenshots/chart_type_gallery.png' });
});