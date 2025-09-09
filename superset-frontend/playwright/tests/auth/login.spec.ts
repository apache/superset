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
import { LOGIN } from '../../utils/urls';

test.describe('Login view', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('should redirect to login with incorrect username and password', async () => {
    // Wait for form to be ready
    await authPage.waitForLoginForm();

    // Setup request interception before login attempt
    const loginRequestPromise = authPage.waitForLoginRequest();

    // Attempt login with incorrect credentials
    await authPage.loginWithCredentials('admin', 'wrongpassword');

    // Wait for login request and verify response
    const loginResponse = await loginRequestPromise;
    // Failed login typically returns 302 redirect back to login page
    expect([200, 302]).toContain(loginResponse.status());

    // Verify we stay on login page
    const currentUrl = await authPage.getCurrentUrl();
    expect(currentUrl).toContain(LOGIN);
  });

  test('should login with correct username and password', async () => {
    // Wait for form to be ready
    await authPage.waitForLoginForm();

    // Setup request interception before login attempt
    const loginRequestPromise = authPage.waitForLoginRequest();

    // Login with correct credentials
    await authPage.loginWithCredentials('admin', 'admin');

    // Wait for login request and verify response
    const loginResponse = await loginRequestPromise;
    expect([200, 302]).toContain(loginResponse.status());

    // Verify successful redirect away from login page
    const currentUrl = await authPage.getCurrentUrl();
    expect(currentUrl).not.toContain(LOGIN);

    // Verify specific session cookie exists
    const sessionCookie = await authPage.getSessionCookie();
    expect(sessionCookie).not.toBeNull();
    expect(sessionCookie?.value).toBeTruthy();

    // Verify logged in state
    const isLoggedIn = await authPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });
});
