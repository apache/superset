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

import { Page, Response } from '@playwright/test';

/**
 * Werkzeug (Flask's dev server, used in CI) periodically drops connections
 * during page navigation under concurrent load — surfacing as
 * `ERR_EMPTY_RESPONSE`, `ERR_CONNECTION_RESET`, or a socket hang up. These
 * are transport-layer failures, not application errors, so retrying the
 * navigation is safe: the next request hits a fresh werkzeug worker thread.
 *
 * Application errors (4xx/5xx, JS exceptions during load) bubble up
 * unchanged — the matcher is narrow on purpose.
 */
const TRANSIENT_NAV_ERROR =
  /ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|socket hang up|ECONNRESET/i;
const NAV_RETRY_ATTEMPTS = 3;
const NAV_RETRY_BACKOFF_MS = 400;

export async function gotoWithRetry(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < NAV_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      lastError = error;
      if (!TRANSIENT_NAV_ERROR.test(String(error))) {
        throw error;
      }
      await new Promise(resolve => {
        setTimeout(resolve, NAV_RETRY_BACKOFF_MS * (attempt + 1));
      });
    }
  }
  throw lastError;
}
