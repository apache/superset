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

import { chromium, FullConfig, Browser, BrowserContext } from '@playwright/test';
import { AuthPage } from './pages/AuthPage';

/**
 * Global setup function that runs once before all tests.
 * Authenticates as admin user and saves the authentication state
 * to be reused by all tests, avoiding repeated UI logins.
 */
async function globalSetup(config: FullConfig) {
  // Get baseURL with fallback to default
  // FullConfig.use doesn't exist in the type - baseURL is only in projects[0].use
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:8088';

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
    await authPage.loginWithCredentials('admin', 'general');
    await authPage.waitForLoginSuccess();

    // Save authentication state for all tests to reuse
    await context.storageState({
      path: 'playwright/.auth/user.json',
    });

    console.log('[Global Setup] Authentication successful - state saved to playwright/.auth/user.json');
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
