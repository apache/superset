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

import { Page, Locator } from '@playwright/test';
import { gotoWithRetry } from '../helpers/navigation';

/** A `.grid-stack-item`'s own position/size, read from the `gs-x`/`gs-y`/`gs-w`/`gs-h` attributes GridStack itself writes — the ground truth of what's actually on screen, independent of anything the app's own React state claims. */
export interface GridItemAttrs {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Page object for the "Dashboard v2" prototype canvas (`/dashboard/v2/new/`)
 * — a GridStack-backed root grid plus a palette of draggable building
 * blocks. No backend persistence: each test starts from a fresh, empty
 * in-memory dashboard.
 *
 * Two distinct drag mechanisms exist on this page and each test helper
 * below is specific to one:
 * - A palette item is native HTML5 `draggable`, read via `dataTransfer`.
 * - An existing `.grid-stack-item` is GridStack's own pointer-based drag
 *   (no `dataTransfer` involved at all).
 * Both are driven identically from Playwright's side (a real mouse
 * press+move+release over the source element) — Chromium's own DnD
 * machinery is what tells them apart, based on the source's own
 * `draggable` attribute, not anything this page object does.
 */
export class DashboardV2Page {
  private readonly page: Page;

  private static readonly SELECTORS = {
    EMPTY_CANVAS: '[data-test="empty-canvas"]',
    EMPTY_CANVAS_PREVIEW: '[data-test="empty-canvas-drop-preview"]',
    CANVAS: '[data-test="canvas"]',
    GRID_CONTAINER: '[data-test="grid-container"]',
    GRID_DROP_GHOST: '[data-test="grid-drop-ghost"]',
    BUILDING_BLOCKS_TAB: 'text=Building blocks',
    GRID_STACK_ITEM: '.grid-stack-item',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await gotoWithRetry(this.page, 'dashboard/v2/new/');
    await this.page.waitForSelector(DashboardV2Page.SELECTORS.EMPTY_CANVAS);
  }

  palette(type: string): Locator {
    return this.page.locator(`[data-test="palette-${type}"]`);
  }

  get emptyCanvas(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.EMPTY_CANVAS);
  }

  get emptyCanvasPreview(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.EMPTY_CANVAS_PREVIEW);
  }

  get canvas(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.CANVAS);
  }

  get gridContainer(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.GRID_CONTAINER);
  }

  get dropGhost(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.GRID_DROP_GHOST);
  }

  gridItems(): Locator {
    return this.page.locator(DashboardV2Page.SELECTORS.GRID_STACK_ITEM);
  }

  /** Reads a `.grid-stack-item`'s own `gs-x`/`gs-y`/`gs-w`/`gs-h` attributes. */
  async gridItemAttrs(item: Locator): Promise<GridItemAttrs> {
    return item.evaluate(el => ({
      x: Number(el.getAttribute('gs-x') ?? '0'),
      y: Number(el.getAttribute('gs-y') ?? '0'),
      w: Number(el.getAttribute('gs-w') ?? '1'),
      h: Number(el.getAttribute('gs-h') ?? '1'),
    }));
  }

  /**
   * Places a block via a plain click (append full-width at the end) — no
   * drag involved, the fastest way to get something onto the canvas for a
   * test that isn't itself exercising placement.
   */
  async placeBlockByClick(type: string): Promise<void> {
    await this.palette(type).click();
    await this.gridItems().first().waitFor();
  }

  /**
   * Switches back to the "Building blocks" palette tab. Placing (or
   * selecting) a block switches the editor panel to Properties, so a test
   * that places one block via `placeBlockByClick` and then wants to drag a
   * second one from the palette needs this in between.
   */
  async showPalette(): Promise<void> {
    await this.page
      .locator(DashboardV2Page.SELECTORS.BUILDING_BLOCKS_TAB)
      .click();
  }

  /**
   * Presses down on a palette item and moves the pointer to `(x, y)` in
   * viewport coordinates, WITHOUT releasing — deliberately not
   * `page.dragAndDrop`, which only performs one atomic down-move-up and
   * gives no chance to inspect a live preview mid-gesture. The caller is
   * responsible for eventually calling `page.mouse.up()`, and may call
   * `page.mouse.move(...)` again first to inspect an intermediate hover
   * position (see `moveTo` below).
   */
  async startPaletteDrag(type: string, x: number, y: number): Promise<void> {
    const box = await this.palette(type).boundingBox();
    if (!box) throw new Error(`Palette item "${type}" has no bounding box`);
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    // A few small steps first: GridStack's own drag threshold (and some
    // native DnD implementations) only recognize a drag once the pointer
    // has actually moved a few pixels, not on the mousedown alone.
    await this.page.mouse.move(
      box.x + box.width / 2 + 10,
      box.y + box.height / 2 + 10,
      { steps: 5 },
    );
    await this.moveTo(x, y);
  }

  /**
   * Presses down on an existing grid item — near its own header band, well
   * clear of the corner resize handles and the top-right remove button —
   * and moves the pointer to `(x, y)`, WITHOUT releasing. This is
   * GridStack's own pointer-based drag, not native HTML5 drag; no
   * `dataTransfer` is involved.
   */
  async startItemDrag(item: Locator, x: number, y: number): Promise<void> {
    const box = await item.boundingBox();
    if (!box) throw new Error('Grid item has no bounding box');
    const grabX = box.x + box.width / 2;
    const grabY = box.y + 12;
    await this.page.mouse.move(grabX, grabY);
    await this.page.mouse.down();
    await this.page.mouse.move(grabX + 15, grabY + 15, { steps: 5 });
    await this.moveTo(x, y);
  }

  /** Continues an in-progress drag (started via `startPaletteDrag`/`startItemDrag`) to a new point, in several steps so intermediate `dragover`/`mousemove` events actually fire. */
  async moveTo(x: number, y: number): Promise<void> {
    await this.page.mouse.move(x, y, { steps: 15 });
  }

  /** Releases the mouse button, ending whichever drag is in progress. */
  async release(): Promise<void> {
    await this.page.mouse.up();
  }

  /**
   * The id of whichever block is currently selected — read from the
   * Inspector's own identity line, not guessed from `placeBlock`'s
   * sequential `node_N` numbering, so a test stays correct even if that
   * numbering ever changes. Needed to build a `scope.targets` list that
   * references a specific block by id (see `applyPropsJson`).
   */
  async getSelectedNodeId(): Promise<string> {
    const id = await this.page
      .locator('[data-test="inspector-identity-meta"]')
      .getAttribute('data-node-id');
    if (!id) throw new Error('No block is currently selected');
    return id;
  }

  /**
   * Applies `props` to whichever block is currently selected, via the
   * Inspector's JSON tab — placing a block (`placeBlockByClick`) already
   * selects it, so this is the way to give a freshly placed block (which
   * starts with no `props` at all) its content without a dedicated form
   * field for every possible key. Only the JSON tab can add a key that
   * doesn't exist yet; see `PropsJsonEditor`.
   */
  async applyPropsJson(props: Record<string, unknown>): Promise<void> {
    await this.page
      .locator('[data-test="inspector-props-tabs"]')
      .getByRole('tab', { name: 'JSON' })
      .click();
    await this.page
      .locator('[data-test="inspector-props"]')
      .fill(JSON.stringify(props));
    await this.page.locator('[data-test="inspector-props-apply"]').click();
  }
}
