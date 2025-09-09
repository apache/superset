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
import { AuthPage } from '../../pages/AuthPage';
import { URL } from '../../utils/urls';

test.describe('Login view', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();

    // Wait for form to be ready
    await authPage.waitForLoginForm();
  });

  test('should redirect to login with incorrect username and password', async ({
    page,
  }) => {
    // Setup request interception before login attempt
    const loginRequestPromise = authPage.waitForLoginRequest();

    // Attempt login with incorrect credentials
    await authPage.loginWithCredentials('admin', 'wrongpassword');

    // Wait for login request and verify response
    const loginResponse = await loginRequestPromise;
    // Failed login returns 401 Unauthorized or 302 redirect to login
    expect([401, 302]).toContain(loginResponse.status());

    // Wait for redirect to complete before checking URL
    await page.waitForURL(url => url.pathname.includes('/login'), {
      timeout: 10000,
    });

    // Verify we stay on login page
    const currentUrl = await authPage.getCurrentUrl();
    expect(currentUrl).toContain(URL.LOGIN);

    // Verify error message is shown
    const hasError = await authPage.hasLoginError();
    expect(hasError).toBe(true);
  });

  test('should login with correct username and password', async ({ page }) => {
    // Setup request interception before login attempt
    const loginRequestPromise = authPage.waitForLoginRequest();

    // Login with correct credentials
    await authPage.loginWithCredentials('admin', 'general');

    // Wait for login request and verify response
    const loginResponse = await loginRequestPromise;
    // Successful login returns 302 redirect
    expect(loginResponse.status()).toBe(302);

    // Wait for successful redirect to welcome page
    await page.waitForURL(url => url.pathname.includes(URL.WELCOME), {
      timeout: 10000,
    });

    // Verify specific session cookie exists
    const sessionCookie = await authPage.getSessionCookie();
    expect(sessionCookie).not.toBeNull();
    expect(sessionCookie?.value).toBeTruthy();
  });
});
