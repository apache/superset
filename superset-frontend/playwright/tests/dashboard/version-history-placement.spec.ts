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

import { testWithAssets, expect } from '../../helpers/fixtures';
import { skipUnlessFeatureEnabled } from '../../helpers/featureFlags';
import { DashboardPage } from '../../pages/DashboardPage';
import { createTestDashboard } from './dashboard-test-helpers';

// The default theme's screenXLMax is 1599. Computed positioning assertions
// below also verify that each viewport exercises its intended branch.
for (const width of [1920, 1280]) {
  testWithAssets(
    `history preserves closed dashboard height and header access at ${width}px`,
    async ({ page, testAssets }) => {
      await page.setViewportSize({ width, height: 1000 });
      await skipUnlessFeatureEnabled(page, 'VERSION_HISTORY');
      const { id } = await createTestDashboard(
        page,
        testAssets,
        testWithAssets.info(),
        { prefix: 'short_history_layout', published: true },
      );

      // Disable only the browser's feature gate for the baseline. The server
      // remains enabled, and the history component and its APIs are unmocked.
      // Context-local storage survives reload without affecting other tests.
      await page.addInitScript(() => {
        // Bootstrap assigns the server flags only while this value is falsy.
        let flags: Record<string, boolean> | undefined;
        Object.defineProperty(window, 'featureFlags', {
          configurable: true,
          get: () => flags,
          set: (value: Record<string, boolean>) => {
            flags = {
              ...value,
              VERSION_HISTORY:
                value.VERSION_HISTORY &&
                sessionStorage.getItem('history-layout-disabled') !== 'true',
            };
          },
        });
      });
      await page.evaluate(() =>
        sessionStorage.setItem('history-layout-disabled', 'true'),
      );
      const dashboard = new DashboardPage(page);
      await dashboard.gotoById(id);
      await dashboard.waitForGridToLoad();

      const header = page.getByTestId('dashboard-header-wrapper');
      const grid = header.locator('..');
      const column = page.getByTestId('dashboard-version-history-column');
      const panel = page.getByRole('complementary', {
        name: 'Version history',
      });
      const measure = () =>
        grid.evaluate(element => ({
          gridHeight: element.getBoundingClientRect().height,
          documentHeight: document.documentElement.scrollHeight,
          documentWidth: document.documentElement.scrollWidth,
        }));

      await expect(column).toHaveCount(0);
      const disabled = await measure();
      // The fixture must actually be short enough to expose a spare viewport.
      expect(disabled.gridHeight).toBeLessThan(1000);
      await page.evaluate(() =>
        sessionStorage.removeItem('history-layout-disabled'),
      );
      await page.reload();
      await dashboard.waitForGridToLoad();
      await expect(column).toHaveCount(1);
      await expect(column).toBeEmpty();
      await expect(column).toHaveCSS('display', 'none');
      await expect
        .poll(async () => {
          const closed = await measure();
          return Math.max(
            Math.abs(closed.gridHeight - disabled.gridHeight),
            Math.abs(closed.documentHeight - disabled.documentHeight),
          );
        })
        .toBeLessThanOrEqual(1);
      const closed = await measure();

      await dashboard.openHeaderActionsMenu();
      await page
        .getByRole('menuitem', { name: 'View version history' })
        .click();
      await expect(panel).toBeVisible();
      await expect(column).toHaveCSS(
        'position',
        width === 1920 ? 'sticky' : 'absolute',
      );
      if (width === 1280) {
        await expect(column).toHaveCSS('grid-column-start', '2');
        await expect(panel).toHaveCSS('position', 'sticky');
        const open = await measure();
        expect(
          Math.abs(open.gridHeight - closed.gridHeight),
        ).toBeLessThanOrEqual(1);
        expect(open.documentWidth).toBeLessThanOrEqual(width + 1);
      }

      // Bring the sticky dashboard header to the top of its scrollport; its
      // measured height, not the global navigation, is the panel's offset.
      await header.evaluate(element => {
        window.scrollBy(0, element.getBoundingClientRect().top);
      });
      await expect
        .poll(async () => {
          const headerBox = await header.boundingBox();
          const panelBox = await panel.boundingBox();
          if (!headerBox || !panelBox) return false;
          return (
            Math.abs(panelBox.y - headerBox.y - headerBox.height) <= 1 &&
            panelBox.y + panelBox.height >= 999 &&
            panelBox.y + panelBox.height <= 1001 &&
            panelBox.x >= 0 &&
            panelBox.x + panelBox.width <= width + 1
          );
        })
        .toBe(true);

      // A real click (not force/trial) proves the open panel doesn't cover
      // the header controls. Opening its menu must leave history open.
      await dashboard.openHeaderActionsMenu();
      await expect(page.getByTestId('header-actions-menu')).toBeVisible();
      await expect(panel).toBeVisible();
      await page.keyboard.press('Escape');

      // Exercise a tall content cell without creating unrelated chart data.
      // In the narrow layout the absolute host must span that entire cell
      // for its child to remain sticky after the global navigation is gone.
      const content = page.getByTestId('dashboard-content-wrapper');
      const originalMinHeight = await content.evaluate(element => {
        const original = element.style.minHeight;
        element.style.minHeight = '2400px';
        return original;
      });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
        .toBeGreaterThanOrEqual(2400);
      for (const scrollY of [0, 240, 0]) {
        await page.evaluate(y => window.scrollTo(0, y), scrollY);
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBe(scrollY);
        await expect
          .poll(async () => {
            const headerBox = await header.boundingBox();
            const panelBox = await panel.boundingBox();
            if (!headerBox || !panelBox) return false;
            return (
              Math.abs(panelBox.y - headerBox.y - headerBox.height) <= 1 &&
              Math.abs(panelBox.y + panelBox.height - 1000) <= 1 &&
              panelBox.x >= 0 &&
              panelBox.x + panelBox.width <= width + 1
            );
          })
          .toBe(true);
      }
      await content.evaluate((element, minHeight) => {
        element.style.minHeight = minHeight;
      }, originalMinHeight);
      await page.getByRole('button', { name: 'Close version history' }).click();
      await expect(panel).toHaveCount(0);
      await expect(column).toHaveCount(1);
      await expect(column).toBeEmpty();
      await expect(column).toHaveCSS('display', 'none');
      await expect
        .poll(async () => {
          const restored = await measure();
          return Math.max(
            Math.abs(restored.gridHeight - closed.gridHeight),
            Math.abs(restored.documentHeight - closed.documentHeight),
          );
        })
        .toBeLessThanOrEqual(1);
    },
  );
}
