// @ts-check
import { test, expect } from '@playwright/test';

test('chart type screenshot', async ({ page }) => {
    await page.goto('/chart/add');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Choose chart type')).toBeVisible();
    await page.getByRole('tab', { name: 'All charts' }).click();
    await page.evaluate(() => document.body.style.zoom = '0.8');
    await page.waitForTimeout(1000); // wait for charts to load
    await (page.locator('.viz-gallery')).screenshot({ path: 'playwright/tests/docs/Screenshots/chart_type_gallery.png' });
});

test('dashboard content screenshot', async ({ page }) => {
    await page.goto('/dashboard/list/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('link', { name: 'Slack Dashboard' }).click();
    await page.evaluate(() => document.body.style.zoom = '0.8');
    await page.waitForTimeout(5000); // wait for chart to load
    await (page.locator('[data-test="dashboard-content-wrapper"]')).screenshot({ path: 'playwright/tests/docs/Screenshots/dashboard-content.png' });
});

test('chart editor screenshot', async ({ page }) => {
    await page.goto('/chart/list/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('[data-test="filters-search"]').fill('life');
    await page.locator('[data-test="filters-search"]').press('Enter');
    await page.locator('[data-test="Life Expectancy VS Rural %-list-chart-title"]').click();
    await page.waitForTimeout(10000); // wait for charts to load
    await page.screenshot({ path: 'playwright/tests/docs/Screenshots/chart-editor.png', fullPage: true });
});

test('sqllab screenshot', async ({ page }) => {
    await page.goto('/sqllab');
    await page.waitForLoadState('domcontentloaded');
    // await page.getByText('duckdbexamples').click();
    // await page.locator('#duckdb-examples-1').getByText('examples').click();
    // await page.locator('[data-test="Select schema or type to search schemas"]').getByText('main').click();
    // await page.locator('div').filter({ hasText: /^main$/ }).nth(2).click();
    await page.getByRole('combobox', { name: 'Select schema or type to' }).fill('main');
    await page.getByRole('combobox', { name: 'Select schema or type to' }).press('Enter');
    await page.getByRole('combobox', { name: 'Select table or type to' }).fill('covid');
    await page.getByRole('combobox', { name: 'Select table or type to' }).press('Enter');
    await page.locator('.ace_content').click();
    await page.getByRole('textbox', { name: 'Cursor at row' }).fill('SELECT "developer_researcher",\n"stage_of_development",\n"product_category",\n"country_name",\nFROM main.covid_vaccines');
    await page.locator('[data-test="run-query-action"]').click();
    await page.waitForTimeout(3000); // wait for charts to load
    await page.screenshot({ path: 'playwright/tests/docs/Screenshots/sqllab.png', fullPage: true });
});