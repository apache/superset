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

import { Page, FrameLocator } from '@playwright/test';
import { EMBEDDED } from '../utils/constants';

/**
 * Page object for the embedded dashboard test app.
 *
 * The test app runs on a separate origin (localhost:9000) and uses the
 * @superset-ui/embedded-sdk to render a Superset dashboard in an iframe.
 * Playwright's page.exposeFunction() bridges the guest token from Node.js
 * into the browser page.
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
   */
  async goto(params: {
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

    await this.page.goto(`${EMBEDDED.APP_URL}/?${searchParams.toString()}`);
  }

  /**
   * FrameLocator for the embedded dashboard iframe.
   */
  get iframe(): FrameLocator {
    return this.page.frameLocator(EmbeddedPage.SELECTORS.IFRAME);
  }

  /**
   * Wait for the iframe to appear in the DOM.
   */
  async waitForIframe(options?: { timeout?: number }): Promise<void> {
    await this.page.locator(EmbeddedPage.SELECTORS.IFRAME).waitFor({
      state: 'attached',
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

  /**
   * Check if the dashboard title is visible inside the iframe.
   */
  async isTitleVisible(): Promise<boolean> {
    const frame = this.iframe;
    return frame
      .locator(
        '[data-test="dashboard-header-container"] [data-test="editable-title-input"]',
      )
      .isVisible();
  }
}
