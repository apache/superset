import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/admin.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.locator('[type="submit"]').click();

  // wait until redirected to any /superset/ URL
  await page.waitForURL("http://localhost:8088/superset/welcome/", { timeout: 60000});


  await page.context().storageState({ path: authFile });
  console.log(`Authentication state saved to ${authFile}`);
});