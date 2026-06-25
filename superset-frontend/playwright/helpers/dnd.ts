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

import { Locator, Page } from '@playwright/test';

/**
 * Drives an HTML5 drag-and-drop using synthetic native drag events.
 *
 * The dashboard grid uses react-dnd with the HTML5 backend
 * (`react-dnd-html5-backend`), which listens for native `dragstart` /
 * `dragenter` / `dragover` / `drop` events rather than the mouse events that
 * Playwright's built-in `locator.dragTo()` produces. To trigger it we dispatch
 * the native drag sequence ourselves, threading a single shared `DataTransfer`
 * object through every event so react-dnd's monitor sees a consistent payload.
 *
 * Mirrors the synthetic-event sequence used by the deprecated Cypress `drag`
 * helper (cypress-base/cypress/utils/index.ts).
 *
 * @param page - Playwright page (used to mint the shared DataTransfer)
 * @param source - The draggable element (or a descendant; drag events bubble)
 * @param target - The drop target element
 */
export async function html5DragAndDrop(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  // Note: we intentionally do not scrollIntoView the source. The chart card list
  // is virtualized, so a separate scroll action can detach the element between
  // resolution and use; dispatchEvent only requires the node to be attached.

  // A single DataTransfer shared across every event in the sequence: react-dnd's
  // HTML5 backend reads/writes drag state through it, so reusing one handle is
  // what makes the monitor treat this as one coherent drag.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await source.dispatchEvent('dragstart', { dataTransfer });
  // react-dnd's HTML5 backend commits monitor state (the active drag source) on a
  // microtask after dragstart; a short settle avoids a race where dragover/drop
  // fire before the backend considers a drag to be in progress.
  await page.waitForTimeout(50);
  // dragenter must precede dragover for react-dnd to register the hover target.
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await page.waitForTimeout(50);
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });

  await dataTransfer.dispose();
}
