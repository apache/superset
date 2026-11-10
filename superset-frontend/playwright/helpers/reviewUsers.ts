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
 * Signing in as somebody other than the suite's single global user.
 *
 * Maker-checker cannot be exercised by one account: the author may never
 * approve their own change, so every assertion about a reviewer needs a
 * second signed-in session, and the viewer cases need a third. The
 * `chromium` project's `storageState` holds exactly one user, so these
 * tests open their own contexts instead and log in through the real form
 * -- the same path `global-setup.ts` takes, just not once for everybody.
 *
 * Deliberately a browser context per user rather than a token per request:
 * these are browser tests, and the thing being asserted is what each
 * person sees on the page.
 */
import { Browser, Page } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { TIMEOUT } from '../utils/constants';

/**
 * Shared password for the review accounts. Overridable so the suite is not
 * the place a credential is pinned.
 */
export const REVIEW_PASSWORD =
  process.env.PLAYWRIGHT_REVIEW_PASSWORD || 'general';

/** Open a fresh, separately-authenticated page for `username`. */
export async function signInAs(
  browser: Browser,
  username: string,
  password: string = REVIEW_PASSWORD,
): Promise<Page> {
  // `storageState: undefined` is load-bearing: without it the new context
  // would inherit the project's saved session and silently be the wrong
  // person, which every maker-checker assertion would then fail for the
  // wrong reason.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.waitForLoginForm();
  await authPage.loginWithCredentials(username, password);
  await authPage.waitForLoginSuccess({ timeout: TIMEOUT.GLOBAL_SETUP });
  return page;
}
