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

import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/admin.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.locator('[type="submit"]').click();

  // wait until redirected to any /superset/ URL
  await page.waitForURL("http://localhost:8088/superset/welcome/", { timeout: 60000});


  await page.context().storageState({ path: authFile });
  console.log(`Authentication state saved to ${authFile}`);
});
