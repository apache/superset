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
 * Dashboard v2 prototype — dropping a palette block onto a blank canvas.
 *
 * All three cases here were live bugs found only by driving a real browser,
 * not by any jsdom-based unit test: jsdom has no layout engine, so
 * `getBoundingClientRect()` always returns zeros there unless a test
 * manually stubs it — which proves the *logic* reads coordinates correctly,
 * never that the *browser* actually measures and lays things out the way
 * the code assumes. These specifically need a real one:
 *
 * 1. The live preview once always filled the entire canvas regardless of
 *    where the cursor was (`width: 100%; height: 100%`) — fixed to be a
 *    cursor-following, capped-size box.
 * 2. The preview once stayed on screen if a drag ended without a `drop` or
 *    `dragleave` (e.g. released past the browser window's own edge) — a
 *    `dragend` backstop was added.
 * 3. A drop always landed at the top-left regardless of where it was
 *    actually released, because the position-aware commit
 *    (`placeBlockAt`) was wired up after the ghost preview was, not with it.
 *
 * Lives under tests/experimental/ until proven stable in CI; run with:
 *   INCLUDE_EXPERIMENTAL=true npm run playwright:test \
 *     playwright/tests/experimental/dashboard-v2/empty-canvas.spec.ts
 */
import { test, expect } from '@playwright/test';
import { DashboardV2Page } from '../../../pages/DashboardV2Page';

test('the live preview follows the cursor and stays capped, not full-canvas', async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  const canvasBox = await dashboard.emptyCanvas.boundingBox();
  if (!canvasBox) throw new Error('empty canvas has no bounding box');

  await dashboard.startPaletteDrag(
    'markdown',
    canvasBox.x + canvasBox.width * 0.15,
    canvasBox.y + canvasBox.height * 0.15,
  );
  const topLeftBox = await dashboard.emptyCanvasPreview.boundingBox();
  if (!topLeftBox) throw new Error('preview did not appear near top-left');

  // Regression: this used to be `width: 100%; height: 100%` of the whole
  // canvas, so it never actually moved with the cursor at all.
  expect(topLeftBox.width).toBeLessThan(canvasBox.width * 0.9);
  expect(topLeftBox.height).toBeLessThan(canvasBox.height * 0.9);

  await dashboard.moveTo(
    canvasBox.x + canvasBox.width * 0.75,
    canvasBox.y + canvasBox.height * 0.75,
  );
  const bottomRightBox = await dashboard.emptyCanvasPreview.boundingBox();
  if (!bottomRightBox) throw new Error('preview disappeared mid-drag');

  // The same box, now positioned near the opposite corner — proves it is
  // actually tracking the cursor, not just rendering somewhere fixed.
  expect(bottomRightBox.x).toBeGreaterThan(topLeftBox.x + 100);
  expect(bottomRightBox.y).toBeGreaterThan(topLeftBox.y + 100);

  await dashboard.release();
});

test('the preview clears if the drag ends without a drop (released off-canvas)', async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  const canvasBox = await dashboard.emptyCanvas.boundingBox();
  if (!canvasBox) throw new Error('empty canvas has no bounding box');

  await dashboard.startPaletteDrag(
    'markdown',
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );
  await expect(dashboard.emptyCanvasPreview).toBeVisible();

  // Move well outside the canvas (into the page's own margin/toolbar area)
  // and release there — no `drop`, no `dragleave` back into the canvas.
  await dashboard.moveTo(canvasBox.x - 40, 5);
  await dashboard.release();

  await expect(dashboard.emptyCanvasPreview).not.toBeVisible();
  // Nothing should have been placed either — this was a cancelled drag.
  await expect(dashboard.gridItems()).toHaveCount(0);
});

test('a drop lands where it was actually released, not always at the top', async ({
  page,
}) => {
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  const canvasBox = await dashboard.emptyCanvas.boundingBox();
  if (!canvasBox) throw new Error('empty canvas has no bounding box');

  const dropX = canvasBox.x + canvasBox.width * 0.6;
  const dropY = canvasBox.y + canvasBox.height * 0.6;
  await dashboard.startPaletteDrag('markdown', dropX, dropY);
  await dashboard.release();

  const item = dashboard.gridItems().first();
  await expect(item).toBeVisible();
  const { y } = await dashboard.gridItemAttrs(item);

  // Regression: this used to always be col 0 / row 0 (`placeBlock`'s
  // append-at-the-end path) regardless of where the drop actually
  // happened. Dropping well below the canvas's own top edge should land
  // at a non-zero row.
  expect(y).toBeGreaterThan(0);
});
