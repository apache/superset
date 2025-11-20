import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/admin.json');

setup('authenticate', async ({ page }) => {
  await page.goto('http://localhost:8088/login/');
  await page.locator('[data-test="username-input"]').fill('admin');
  await page.locator('[data-test="password-input"]').fill('admin');
  await page.locator('[data-test="login-button"]').click();

  // wait until redirected to any /superset/ URL
  await page.waitForURL("http://localhost:8088/superset/welcome/");


  await page.context().storageState({ path: authFile });
  console.log(`Authentication state saved to ${authFile}`);
});