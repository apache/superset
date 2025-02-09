import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'username' }).fill('admin');
  await page.getByRole('textbox', { name: 'password' }).fill('general');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('/superset/welcome/');
  await page.context().storageState({ path: authFile });
});
