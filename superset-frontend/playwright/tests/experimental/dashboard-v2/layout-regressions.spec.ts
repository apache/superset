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
 * Dashboard v2 prototype — scroll ownership for a canvas taller than the
 * viewport.
 *
 * `RootGrid`'s own surface (`data-container-id="root"`) and the page-level
 * `Canvas` (`data-test="canvas"`) both used to be independent
 * `overflow: auto` boxes nested inside one another — two scroll containers
 * fighting over the same mouse-wheel input, which reads as broken
 * scrolling rather than "the canvas is tall, scroll it". This is a real
 * CSS cascade/box-model question with no jsdom equivalent: jsdom never
 * actually computes `scrollHeight`/`clientHeight`/`overflow` against a real
 * layout, so a unit test asserting this would only ever assert whatever
 * value a test manually stubbed in.
 *
 * Lives under tests/experimental/ until proven stable in CI; run with:
 *   INCLUDE_EXPERIMENTAL=true npm run playwright:test \
 *     playwright/tests/experimental/dashboard-v2/layout-regressions.spec.ts
 */
import { test, expect } from '@playwright/test';
import { DashboardV2Page } from '../../../pages/DashboardV2Page';

test('the canvas is the single scroll owner when content overflows the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 600 });
  const dashboard = new DashboardV2Page(page);
  await dashboard.goto();

  // Enough tall blocks to guarantee the canvas overflows a 600px viewport.
  for (let i = 0; i < 5; i += 1) {
    await dashboard.placeBlockByClick('echarts');
    await dashboard.showPalette();
  }

  const canvasMetrics = await dashboard.canvas.evaluate(el => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  expect(canvasMetrics.overflowY).toBe('auto');
  expect(canvasMetrics.scrollHeight).toBeGreaterThan(
    canvasMetrics.clientHeight,
  );

  const rootMetrics = await page
    .locator('[data-container-id="root"]')
    .evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
  // Regression: this used to also be `overflow-y: auto` with its own
  // `scrollHeight > clientHeight`, giving it a second, independent
  // scrollbar of its own.
  expect(rootMetrics.overflowY).toBe('visible');
});
