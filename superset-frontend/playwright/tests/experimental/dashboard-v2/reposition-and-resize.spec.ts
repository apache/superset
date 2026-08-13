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
 * Dashboard v2 prototype — dragging/resizing a block already on the grid.
 *
 * Every case here was a real bug found only by driving GridStack in a real
 * browser; none of them were (or could be) caught by the jsdom-mocked
 * `RootGrid.test.tsx` suite, since jsdom never actually runs GridStack's own
 * DOM/CSS logic:
 *
 * 1. GridStack's own `auto: true` silently claimed every widget present at
 *    mount with no `id`, before this app's own code ever got to register
 *    them — every drag committed nothing and visibly reverted on drop.
 * 2. An over-broad `cancel` selector matched the grid's own ancestor
 *    marker on every press, vetoing every drag unconditionally (resize
 *    alone worked, since it's a separate code path that never checks
 *    `cancel`).
 * 3. A CSS `min-height: 100%` (instead of `height: 100%`) on the grid's own
 *    surface broke the percentage-height chain for `.grid-stack`'s own
 *    floor, shrinking its real drop target to fit only existing content —
 *    any empty space beyond sparse content silently fell back to a
 *    different, ghost-less, always-full-width drop path.
 *
 * Lives under tests/experimental/ until proven stable in CI; run with:
 *   INCLUDE_EXPERIMENTAL=true npm run playwright:test \
 *     playwright/tests/experimental/dashboard-v2/reposition-and-resize.spec.ts
 */
import { test, expect } from '@playwright/test';
import { DashboardV2Page } from '../../../pages/DashboardV2Page';

test('dragging an existing block to a new position persists', async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();
  await dashboard.placeBlockByClick('markdown');

  const item = dashboard.gridItems().first();
  const before = await dashboard.gridItemAttrs(item);

  const box = await item.boundingBox();
  if (!box) throw new Error('grid item has no bounding box');
  await dashboard.startItemDrag(
    item,
    box.x + box.width / 2 + 200,
    box.y + box.height / 2 + 300,
  );
  await dashboard.release();

  const after = await dashboard.gridItemAttrs(item);
  // Regression: this used to always equal `before` — the drag visibly
  // moved the block, then it snapped straight back on release.
  expect(after.y).toBeGreaterThan(before.y);

  // Survives an unrelated re-render (switching palette tabs), not just
  // looking right until something else touches the store.
  await dashboard.showPalette();
  const afterRerender = await dashboard.gridItemAttrs(item);
  expect(afterRerender).toEqual(after);
});

test('resizing an existing block from a corner persists', async ({ page }) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();
  await dashboard.placeBlockByClick('markdown');

  const item = dashboard.gridItems().first();
  const before = await dashboard.gridItemAttrs(item);
  // `placeBlockByClick` appends full-width (`DEFAULT_COLUMNS`, the grid's
  // own max) — there is no wider to resize to, so the corner picked here
  // has to be one that can still demonstrate a *width* change too, not
  // just height. `sw` (bottom-left) shrinks width while growing height;
  // `se` alone couldn't have grown width past the columns it already
  // spans.
  expect(before.w).toBeGreaterThan(1);

  // The resize handles are hidden (`ui-resizable-autohide`) until the
  // pointer is actually over the item.
  await item.hover();
  const handle = item.locator('.ui-resizable-sw');
  await handle.waitFor({ state: 'visible' });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('resize handle has no bounding box');

  // `sw` anchors the top-right corner: moving the cursor toward the
  // block's own interior (right, since this is its bottom-*left* corner)
  // shrinks the width; moving it down grows the height.
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 15, startY + 15, { steps: 5 });
  await page.mouse.move(startX + 200, startY + 150, { steps: 15 });
  await page.mouse.up();

  const after = await dashboard.gridItemAttrs(item);
  expect(after.w).toBeLessThan(before.w);
  expect(after.h).toBeGreaterThan(before.h);

  await dashboard.showPalette();
  const afterRerender = await dashboard.gridItemAttrs(item);
  expect(afterRerender).toEqual(after);
});

test('dropping into open space below sparse content shows a live preview and lands at less than full width', async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  // Place one block near the top-left, leaving a large empty area below.
  const canvasBox = await dashboard.emptyCanvas.boundingBox();
  if (!canvasBox) throw new Error('empty canvas has no bounding box');
  await dashboard.startPaletteDrag(
    'markdown',
    canvasBox.x + 80,
    canvasBox.y + 60,
  );
  await dashboard.release();
  await dashboard.showPalette();

  const gridBox = await dashboard.gridContainer.boundingBox();
  if (!gridBox) throw new Error('grid container has no bounding box');

  // Hover far below the first block, still within the canvas.
  await dashboard.startPaletteDrag(
    'markdown',
    gridBox.x + 80,
    gridBox.y + gridBox.height - 80,
  );
  await expect(dashboard.dropGhost).toBeVisible();
  const ghostBox = await dashboard.dropGhost.boundingBox();
  if (!ghostBox) throw new Error('ghost did not appear');
  // Regression: `.grid-stack`'s own real box used to shrink to fit only
  // the first block, so this point fell outside it entirely and no ghost
  // ever appeared here.
  expect(ghostBox.width).toBeLessThan(gridBox.width * 0.9);

  await dashboard.release();

  await expect(dashboard.gridItems()).toHaveCount(2);
  const second = await dashboard.gridItemAttrs(dashboard.gridItems().nth(1));
  // Regression: the same fallback path that skipped the ghost also always
  // appended a full-width block regardless of where the drop happened.
  expect(second.w).toBeLessThan(24);
});
