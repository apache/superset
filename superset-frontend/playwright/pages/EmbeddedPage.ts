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

import { Page, FrameLocator, Locator, expect } from '@playwright/test';
import { EMBEDDED } from '../utils/constants';

/**
 * Page object for the embedded dashboard test app.
 *
 * The test app runs on a separate origin (its origin is assigned per-suite
 * via an OS-allocated port) and uses the @superset-ui/embedded-sdk to render
 * a Superset dashboard in an iframe. Playwright's page.exposeFunction()
 * bridges the guest token from Node.js into the browser page.
 */
export class EmbeddedPage {
  private readonly page: Page;

  private static readonly SELECTORS = {
    CONTAINER: '[data-test="embedded-container"]',
    IFRAME: 'iframe[title="Embedded Dashboard"]',
    STATUS: '#status',
    ERROR: '#error',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set up the guest token bridge before navigating.
   * Must be called BEFORE goto() since embedDashboard() calls fetchGuestToken
   * immediately on page load.
   */
  async exposeTokenFetcher(tokenFn: () => Promise<string>): Promise<void> {
    await this.page.exposeFunction('__fetchGuestToken', tokenFn);
  }

  /**
   * Navigate to the embedded test app with the given parameters.
   * `appUrl` is the origin of the static test app (assigned dynamically by
   * the spec's beforeAll fixture so workers don't collide on a fixed port).
   */
  async goto(params: {
    appUrl: string;
    uuid: string;
    supersetDomain: string;
    hideTitle?: boolean;
    hideTab?: boolean;
    hideChartControls?: boolean;
    debug?: boolean;
  }): Promise<void> {
    const searchParams = new URLSearchParams({
      uuid: params.uuid,
      supersetDomain: params.supersetDomain,
    });
    if (params.hideTitle) searchParams.set('hideTitle', 'true');
    if (params.hideTab) searchParams.set('hideTab', 'true');
    if (params.hideChartControls) searchParams.set('hideChartControls', 'true');
    if (params.debug) searchParams.set('debug', 'true');

    await this.page.goto(`${params.appUrl}/?${searchParams.toString()}`);
  }

  /**
   * FrameLocator for the embedded dashboard iframe.
   */
  get iframe(): FrameLocator {
    return this.page.frameLocator(EmbeddedPage.SELECTORS.IFRAME);
  }

  /**
   * Wait for the iframe to appear in the DOM AND have its src set.
   * The SDK appends the iframe element before assigning src, so a bare
   * `state: 'attached'` wait races the src read.
   */
  async waitForIframe(options?: { timeout?: number }): Promise<void> {
    const locator = this.page.locator(EmbeddedPage.SELECTORS.IFRAME);
    await locator.waitFor({
      state: 'attached',
      timeout: options?.timeout ?? EMBEDDED.IFRAME_LOAD,
    });
    await expect(locator).toHaveAttribute('src', /.+/, {
      timeout: options?.timeout ?? EMBEDDED.IFRAME_LOAD,
    });
  }

  /**
   * Wait for dashboard content to render inside the iframe.
   * Looks for the grid-container which indicates charts are loading/loaded.
   */
  async waitForDashboardContent(options?: { timeout?: number }): Promise<void> {
    const frame = this.iframe;
    await frame
      .locator('.grid-container, [data-test="grid-container"]')
      .first()
      .waitFor({
        state: 'visible',
        timeout: options?.timeout ?? EMBEDDED.DASHBOARD_RENDER,
      });
  }

  /**
   * Matches a chart cell that has finished loading: it contains a real viz
   * element (svg, canvas, table) AND no longer hosts the `Loading` spinner
   * (`data-test="loading-indicator"`). Excluding the spinner matters —
   * the spinner itself renders an SVG, so a `:has(svg)`-only check can match
   * a still-loading chart for the wrong reason.
   */
  static readonly RENDERED_CHART_SELECTOR =
    '[data-test="chart-container"]:has(svg, canvas, table):not(:has([data-test="loading-indicator"]))';

  /**
   * Wait for at least one chart to finish rendering — viz drawn AND no
   * loading spinner in that cell.
   */
  async waitForChartRendered(options?: { timeout?: number }): Promise<void> {
    await this.iframe
      .locator(EmbeddedPage.RENDERED_CHART_SELECTOR)
      .first()
      .waitFor({
        state: 'visible',
        timeout: options?.timeout ?? EMBEDDED.CHART_RENDER,
      });
  }

  /**
   * Locator for the dashboard title input inside the iframe.
   * Returned as a `Locator` so callers can use `expect(...).toBeVisible()` /
   * `.toBeHidden()` with auto-retry instead of one-shot `.isVisible()`.
   */
  get titleLocator(): Locator {
    return this.iframe.locator(
      '[data-test="dashboard-header-container"] [data-test="editable-title-input"]',
    );
  }

  /**
   * Get the status text from the test app.
   */
  async getStatus(): Promise<string> {
    return (
      (await this.page.locator(EmbeddedPage.SELECTORS.STATUS).textContent()) ??
      ''
    );
  }

  /**
   * Get the error text, if any.
   */
  async getError(): Promise<string> {
    const errorEl = this.page.locator(EmbeddedPage.SELECTORS.ERROR);
    const display = await errorEl.evaluate(el => getComputedStyle(el).display);
    if (display === 'none') return '';
    return (await errorEl.textContent()) ?? '';
  }
}
