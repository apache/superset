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
 * Widgets stay inside the cells the canvas gives them, checked with real
 * layout in a real browser: what JSDOM cannot measure.
 *
 * Runs only against a backend with CANVAS on. The dedicated CI step sets
 * PLAYWRIGHT_REQUIRE_CANVAS, which turns a disabled backend into a failure
 * rather than a skip.
 */
import { Locator, Page, test as base, expect } from '@playwright/test';
import {
  CanvasSeedTracker,
  DRAFT_NODES,
  PUBLISHED_NODES,
  canvasPath,
  requireOrSkipCanvas,
  seedDraftGroupCanvas,
  seedPublishedCanvas,
} from '../../helpers/api/canvas';
import { TIMEOUT } from '../../utils/constants';

const test = base.extend<{ canvasSeed: CanvasSeedTracker }>({
  canvasSeed: async ({ page }, use) => {
    const tracker = new CanvasSeedTracker(page);
    await use(tracker);
    await tracker.cleanup();
  },
});

// Tall enough that the table, the chart below it and the group all fit
// without scrolling the page, so points taken from their boxes are on screen.
test.use({ viewport: { width: 1600, height: 1200 } });

// Each check seeds through the API and waits on live queries before it
// measures anything; the bound covers the seeding and the probe as well.
test.describe.configure({ timeout: TIMEOUT.SLOW_TEST });

test.beforeEach(async ({ page }) => {
  await requireOrSkipCanvas(page);
});

const node = (page: Page, id: string): Locator =>
  page.locator(`[data-test="canvas-node"][data-node-id="${id}"]`);

/** The box a widget's content is bounded and scrolls in. */
const contentOf = (widget: Locator): Locator =>
  widget.locator('.canvas-content').first();

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'element is rendered').not.toBeNull();
  return box as NonNullable<typeof box>;
}

/** The placement id of the widget painted at a viewport point. */
const nodeAt = (page: Page, x: number, y: number): Promise<string | null> =>
  page.evaluate(
    ([px, py]) =>
      document
        .elementFromPoint(px, py)
        ?.closest('[data-test="canvas-node"]')
        ?.getAttribute('data-node-id') ?? null,
    [x, y] as const,
  );

/**
 * The placement ids of every widget with content at a viewport point, topmost
 * first. Unlike `nodeAt`, this sees a widget painting underneath another one:
 * a later grid item wins the topmost hit even where an earlier item's
 * overflow is drawn beneath it.
 */
const paintsAt = (page: Page, x: number, y: number): Promise<string[]> =>
  page.evaluate(
    ([px, py]) => [
      ...new Set(
        document
          .elementsFromPoint(px, py)
          .map(element =>
            element
              .closest('[data-test="canvas-node"]')
              ?.getAttribute('data-node-id'),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    [x, y] as const,
  );

test('a many-row table scrolls inside its cell and leaves the chart below it uncovered', async ({
  page,
  canvasSeed,
}) => {
  const { canvasId } = await seedPublishedCanvas(page, canvasSeed);
  await page.goto(canvasPath(canvasId));

  const table = node(page, PUBLISHED_NODES.table);
  const following = node(page, PUBLISHED_NODES.following);
  const rows = table.locator('tr.ant-table-row');
  await expect(rows.first()).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
  await expect(following.locator('canvas').first()).toBeVisible({
    timeout: TIMEOUT.CHART_RENDER,
  });

  const scroller = contentOf(table);
  const { scrollHeight, clientHeight } = await scroller.evaluate(element => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  // Just inside the chart's top edge, under the table's centre line. Rows
  // spilling out of the table's cell would be in the hit stack here, even
  // where the chart is painted over them.
  const cell = await boxOf(table);
  const below = await boxOf(following);
  const probeX = cell.x + cell.width / 2;
  const probeY = below.y + 4;
  expect(await paintsAt(page, probeX, probeY)).not.toContain(
    PUBLISHED_NODES.table,
  );
  expect(await nodeAt(page, probeX, probeY)).toBe(PUBLISHED_NODES.following);

  const lastRow = rows.last();
  const header = table.locator('.ant-table-thead').first();
  const before = await boxOf(scroller);
  expect((await boxOf(lastRow)).y).toBeGreaterThan(before.y + before.height);

  await scroller.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(lastRow).toBeInViewport();
  const scrolled = await boxOf(scroller);
  const last = await boxOf(lastRow);
  expect(last.y + last.height).toBeLessThanOrEqual(
    scrolled.y + scrolled.height + 1,
  );
  const head = await boxOf(header);
  expect(head.y).toBeGreaterThanOrEqual(scrolled.y - 1);
  expect(head.y + head.height).toBeLessThanOrEqual(
    scrolled.y + scrolled.height,
  );
  // The sticky header is what is painted there, not a row scrolled under it.
  const headerHit = await page.evaluate(
    ([px, py]) =>
      Boolean(document.elementFromPoint(px, py)?.closest('.ant-table-thead')),
    [head.x + head.width / 2, head.y + head.height / 2] as const,
  );
  expect(headerHit).toBe(true);
  expect(await paintsAt(page, probeX, probeY)).not.toContain(
    PUBLISHED_NODES.table,
  );
  expect(await nodeAt(page, probeX, probeY)).toBe(PUBLISHED_NODES.following);
});

test('a marked titled group keeps its last child inside its own bounds in a draft', async ({
  page,
  canvasSeed,
}) => {
  const { canvasId, draftToken } = await seedDraftGroupCanvas(page, canvasSeed);
  await page.goto(canvasPath(canvasId, draftToken));

  const group = node(page, DRAFT_NODES.group);
  const last = node(page, DRAFT_NODES.last);
  await expect(group.getByTestId('canvas-widget-mark').first()).toBeVisible({
    timeout: TIMEOUT.CHART_RENDER,
  });
  await expect(last.getByText('Last row of the group')).toBeVisible();

  const bounds = await boxOf(contentOf(group));
  const child = await boxOf(last);
  expect(child.y).toBeGreaterThanOrEqual(bounds.y - 1);
  expect(child.y + child.height).toBeLessThanOrEqual(
    bounds.y + bounds.height + 1,
  );
  // The child's bottom edge is painted, not clipped away by the group.
  expect(
    await nodeAt(page, child.x + child.width / 2, child.y + child.height - 4),
  ).toBe(DRAFT_NODES.last);
});
