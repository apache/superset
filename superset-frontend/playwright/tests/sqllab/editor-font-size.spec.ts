/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * SQL Lab editor font size control.
 *
 * The "Text size" toolbar widget raises, lowers and resets the SQL editor font
 * size. The value is clamped to [8, 32] in steps of 2 (default 12), persisted
 * to localStorage, and applied to the live Ace editor.
 *
 * Runs in the sequential chromium-sqllab project (see sqllab.spec.ts).
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../../helpers/fixtures/testAssets';
import { SqlLabPage } from '../../pages/SqlLabPage';
import { TIMEOUT } from '../../utils/constants';

const STORAGE_KEY = 'sqllab__editor_font_size';
const DEFAULT_FONT_SIZE = 12;
const STEP = 2;
const MIN_FONT_SIZE = 8;

const increaseButton = (page: Page) =>
  page.getByRole('button', { name: 'Increase text size' });
const decreaseButton = (page: Page) =>
  page.getByRole('button', { name: 'Decrease text size' });
const resetButton = (page: Page) => page.getByRole('button', { name: 'Reset' });
const sizeValue = (page: Page) => page.getByTestId('text-size-value');

async function storedFontSize(page: Page): Promise<number | null> {
  const raw = await page.evaluate(
    key => window.localStorage.getItem(key),
    STORAGE_KEY,
  );
  return raw === null ? null : Number(raw);
}

async function aceFontSizePx(page: Page): Promise<number> {
  return page
    .locator('.ace_editor:visible')
    .first()
    .evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);
  await new SqlLabPage(page).gotoAndReady();
  await expect(page.getByTestId('text-size-editor')).toBeVisible();
  // Start every test from the default so assertions don't depend on a size
  // persisted by a previous run.
  await resetButton(page).click();
  await expect(sizeValue(page)).toHaveText(String(DEFAULT_FONT_SIZE));
});

test('increasing the text size grows and persists the editor font', async ({
  page,
}) => {
  await increaseButton(page).click();

  const expected = DEFAULT_FONT_SIZE + STEP;
  await expect(sizeValue(page)).toHaveText(String(expected));
  expect(await storedFontSize(page)).toBe(expected);
  await expect.poll(() => aceFontSizePx(page)).toBe(expected);
});

test('decreasing the text size shrinks and persists the editor font', async ({
  page,
}) => {
  await decreaseButton(page).click();

  const expected = DEFAULT_FONT_SIZE - STEP;
  await expect(sizeValue(page)).toHaveText(String(expected));
  expect(await storedFontSize(page)).toBe(expected);
  await expect.poll(() => aceFontSizePx(page)).toBe(expected);
});

test('reset restores the default text size', async ({ page }) => {
  await increaseButton(page).click();
  await increaseButton(page).click();
  await expect(sizeValue(page)).toHaveText(
    String(DEFAULT_FONT_SIZE + 2 * STEP),
  );

  await resetButton(page).click();

  await expect(sizeValue(page)).toHaveText(String(DEFAULT_FONT_SIZE));
  expect(await storedFontSize(page)).toBe(DEFAULT_FONT_SIZE);
  await expect.poll(() => aceFontSizePx(page)).toBe(DEFAULT_FONT_SIZE);
});

test('the text size stops at the minimum', async ({ page }) => {
  // 12 -> 10 -> 8, after which the decrease button is disabled.
  await decreaseButton(page).click();
  await decreaseButton(page).click();

  await expect(sizeValue(page)).toHaveText(String(MIN_FONT_SIZE));
  await expect(decreaseButton(page)).toBeDisabled();
  expect(await storedFontSize(page)).toBe(MIN_FONT_SIZE);
});

test('the chosen text size is kept after a page reload', async ({ page }) => {
  await increaseButton(page).click();
  const expected = DEFAULT_FONT_SIZE + STEP;
  await expect(sizeValue(page)).toHaveText(String(expected));

  await new SqlLabPage(page).gotoAndReady();

  await expect(sizeValue(page)).toHaveText(String(expected));
  await expect.poll(() => aceFontSizePx(page)).toBe(expected);
});
