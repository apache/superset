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
import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/HomePage';
import { TIMEOUT } from '../../utils/constants';

// Smoke test guarding against a blank Home/welcome landing page (e.g. a shell
// or route-layout regression that renders only the top navigation). The auth
// suite only waits for the welcome URL + session cookie, so it would not catch
// a welcome page that redirects correctly but renders no content.
test('welcome page renders its content, not just the nav', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();

  // "Recents" is a Home content section header (a Collapse panel) that does not
  // exist in the top navigation, so its presence proves the route content
  // rendered — not just the app shell.
  await expect(homePage.getRecentsSection()).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
});
