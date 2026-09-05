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
import { test, expect, Page } from '@playwright/test';

const STORY_URL =
  '/iframe.html?id=design-system-components-pageheaderwithactions--dashboard-header&viewMode=story';

// Sweeps from a comfortably wide header down to a narrow browser window,
// matching the reported repro (shrinking the browser window narrows the
// header until the metadata bar/owner info overlaps the kebab menu instead
// of collapsing).
const VIEWPORT_WIDTHS = [1200, 900, 700, 600, 500, 450, 400, 360, 320];

type Rect = { left: number; top: number; right: number; bottom: number };

// A clipped ancestor (overflow: hidden/auto/scroll/clip) hides any part of
// an element that falls outside its box, so the element's raw
// getBoundingClientRect() overstates what a user can actually see. Intersect
// it with every clipping ancestor to get the rect that's actually rendered,
// which is what "does this overlap something else on screen" needs to check.
const getVisibleRect = (page: Page, selector: string): Promise<Rect> =>
  page.$eval(selector, el => {
    const rect = el.getBoundingClientRect();
    const visible = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
    let node = el.parentElement;
    while (node) {
      const { overflow, overflowX, overflowY } = getComputedStyle(node);
      if (
        overflow !== 'visible' ||
        overflowX !== 'visible' ||
        overflowY !== 'visible'
      ) {
        const ancestorRect = node.getBoundingClientRect();
        visible.left = Math.max(visible.left, ancestorRect.left);
        visible.top = Math.max(visible.top, ancestorRect.top);
        visible.right = Math.min(visible.right, ancestorRect.right);
        visible.bottom = Math.min(visible.bottom, ancestorRect.bottom);
      }
      node = node.parentElement;
    }
    return visible;
  });

const isEmpty = (rect: Rect) =>
  rect.right <= rect.left || rect.bottom <= rect.top;

const rectsIntersect = (a: Rect, b: Rect) =>
  !isEmpty(a) &&
  !isEmpty(b) &&
  a.left < b.right &&
  b.left < a.right &&
  a.top < b.bottom &&
  b.top < a.bottom;

test('dashboard header metadata bar never overlaps the actions menu as the window narrows', async ({
  page,
}) => {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(STORY_URL, { waitUntil: 'networkidle' });

    await expect(page.locator('[data-test="metadata-bar"]')).toBeVisible();
    await expect(page.locator('.right-button-panel')).toBeVisible();

    const metadataBarRect = await getVisibleRect(
      page,
      '[data-test="metadata-bar"]',
    );
    const rightButtonPanelRect = await getVisibleRect(
      page,
      '.right-button-panel',
    );

    expect(
      rectsIntersect(metadataBarRect, rightButtonPanelRect),
      `metadata bar visually overlapped the actions menu panel at viewport width ${width}px`,
    ).toBe(false);
  }
});
