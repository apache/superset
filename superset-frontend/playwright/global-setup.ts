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

import {
  chromium,
  FullConfig,
  Browser,
  BrowserContext,
} from '@playwright/test';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { AuthPage } from './pages/AuthPage';
import { TIMEOUT } from './utils/constants';

/**
 * Global setup function that runs once before all tests.
 * Authenticates as admin user and saves the authentication state
 * to be reused by tests in the 'chromium' project (E2E tests).
 *
 * Auth tests (chromium-unauth project) don't use this - they login
 * per-test via beforeEach for isolation and simplicity.
 */
async function globalSetup(config: FullConfig) {
  // Get baseURL with fallback to default
  // FullConfig.use doesn't exist in the type - baseURL is only in projects[0].use
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:8088';

  // Test credentials - can be overridden via environment variables
  const adminUsername = process.env.PLAYWRIGHT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'general';

  console.log('[Global Setup] Authenticating as admin user...');

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    // Launch browser
    browser = await chromium.launch();
  } catch (error) {
    console.error('[Global Setup] Failed to launch browser:', error);
    throw new Error('Browser launch failed - check Playwright installation');
  }

  try {
    context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    // Use AuthPage to handle login logic (DRY principle)
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.waitForLoginForm();
    await authPage.loginWithCredentials(adminUsername, adminPassword);
    // Use longer timeout for global setup (cold CI starts may exceed PAGE_LOAD timeout)
    await authPage.waitForLoginSuccess({ timeout: TIMEOUT.GLOBAL_SETUP });

    // Save authentication state for all tests to reuse
    const authStatePath = 'playwright/.auth/user.json';
    await mkdir(dirname(authStatePath), { recursive: true });
    await context.storageState({
      path: authStatePath,
    });

    console.log(
      '[Global Setup] Authentication successful - state saved to playwright/.auth/user.json',
    );
  } catch (error) {
    console.error('[Global Setup] Authentication failed:', error);
    throw error;
  } finally {
    // Ensure cleanup even if auth fails
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

export default globalSetup;
