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
 * Dashboard v2 prototype — dropping/dragging a block onto the left/right
 * half of an *existing* block splits it: the existing block shrinks to the
 * other half, and the dragged/dropped block takes the half it landed on.
 *
 * The live-preview assertions here (the existing block visibly shrinking
 * mid-hover, not a placeholder box standing in for it) are the one piece of
 * this feature that is fundamentally unverifiable outside a real browser —
 * it depends on `useGridStack`'s sync effect actually diffing a
 * temporarily-substituted rect against GridStack's live DOM node and
 * calling `update()` on it, mid-gesture, before anything is committed.
 *
 * Lives under tests/experimental/ until proven stable in CI; run with:
 *   INCLUDE_EXPERIMENTAL=true npm run playwright:test \
 *     playwright/tests/experimental/dashboard-v2/split.spec.ts
 */
import { test, expect } from '@playwright/test';
import { DashboardV2Page } from '../../../pages/DashboardV2Page';

test("a palette drop on an existing block's left half splits it, live", async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();
  await dashboard.placeBlockByClick('markdown');
  await dashboard.showPalette();

  const target = dashboard.gridItems().first();
  const targetBoxBefore = await target.boundingBox();
  if (!targetBoxBefore) throw new Error('target block has no bounding box');

  // Hover the left quarter of the target, vertically centered on it (the
  // middle band — not near its top/bottom edge, which means "insert a
  // full-width row" instead of "split").
  await dashboard.startPaletteDrag(
    'markdown',
    targetBoxBefore.x + targetBoxBefore.width * 0.15,
    targetBoxBefore.y + targetBoxBefore.height / 2,
  );

  // The REAL target block visibly shrinks to the right half, live — not a
  // second placeholder box drawn over it.
  const targetBoxDuring = await target.boundingBox();
  if (!targetBoxDuring) throw new Error('target block disappeared mid-hover');
  expect(targetBoxDuring.width).toBeLessThan(targetBoxBefore.width * 0.7);
  expect(targetBoxDuring.x).toBeGreaterThan(targetBoxBefore.x);

  // The new block's own ghost occupies the complementary (left) half.
  const ghostBox = await dashboard.dropGhost.boundingBox();
  if (!ghostBox) throw new Error('drop ghost did not appear');
  expect(ghostBox.x).toBeLessThan(targetBoxDuring.x);
  expect(ghostBox.width).toBeLessThan(targetBoxBefore.width * 0.7);

  await dashboard.release();

  await expect(dashboard.gridItems()).toHaveCount(2);
  const items = dashboard.gridItems();
  const first = await dashboard.gridItemAttrs(items.nth(0));
  const second = await dashboard.gridItemAttrs(items.nth(1));
  // Both halves, side by side, on the same row, neither full width.
  expect(first.y).toBe(second.y);
  expect(first.w).toBeLessThan(24);
  expect(second.w).toBeLessThan(24);
  expect(first.x).not.toBe(second.x);
});

test("dragging an existing block onto another block's half splits it the same way", async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  // Two full-width blocks, one above the other.
  await dashboard.placeBlockByClick('markdown');
  await dashboard.showPalette();
  await dashboard.placeBlockByClick('echarts');
  await dashboard.showPalette();

  const items = dashboard.gridItems();
  const target = items.nth(0); // markdown, on top
  const dragged = items.nth(1); // echarts, below it

  const targetBox = await target.boundingBox();
  const draggedBox = await dragged.boundingBox();
  if (!targetBox || !draggedBox) {
    throw new Error('one of the two blocks has no bounding box');
  }

  // Drag the second block up onto the first one's left half.
  await dashboard.startItemDrag(
    dragged,
    targetBox.x + targetBox.width * 0.15,
    targetBox.y + targetBox.height / 2,
  );
  await dashboard.release();

  const firstAttrs = await dashboard.gridItemAttrs(items.nth(0));
  const secondAttrs = await dashboard.gridItemAttrs(items.nth(1));
  expect(firstAttrs.y).toBe(secondAttrs.y);
  expect(firstAttrs.w).toBeLessThan(24);
  expect(secondAttrs.w).toBeLessThan(24);
  expect(firstAttrs.x).not.toBe(secondAttrs.x);
});
