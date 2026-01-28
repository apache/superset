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

import { Page, Response, Cookie } from '@playwright/test';
import { Form } from '../components/core';
import { URL } from '../utils/urls';
import { TIMEOUT } from '../utils/constants';

export class AuthPage {
  private readonly page: Page;

  private readonly loginForm: Form;

  // Selectors specific to the auth/login page
  private static readonly SELECTORS = {
    LOGIN_FORM: '[data-test="login-form"]',
    USERNAME_INPUT: '[data-test="username-input"]',
    PASSWORD_INPUT: '[data-test="password-input"]',
    LOGIN_BUTTON: '[data-test="login-button"]',
    ERROR_SELECTORS: [
      '[role="alert"]',
      '.ant-form-item-explain-error',
      '.ant-form-item-explain.ant-form-item-explain-error',
      '.alert-danger',
    ],
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.loginForm = new Form(page, AuthPage.SELECTORS.LOGIN_FORM);
  }

  /**
   * Navigate to the login page
   */
  async goto(): Promise<void> {
    await this.page.goto(URL.LOGIN);
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginForm(): Promise<void> {
    await this.loginForm.waitForVisible({ timeout: TIMEOUT.FORM_LOAD });
  }

  /**
   * Login with provided credentials
   * @param username - Username to enter
   * @param password - Password to enter
   */
  async loginWithCredentials(
    username: string,
    password: string,
  ): Promise<void> {
    const usernameInput = this.loginForm.getInput(
      AuthPage.SELECTORS.USERNAME_INPUT,
    );
    const passwordInput = this.loginForm.getInput(
      AuthPage.SELECTORS.PASSWORD_INPUT,
    );
    const loginButton = this.loginForm.getButton(
      AuthPage.SELECTORS.LOGIN_BUTTON,
    );

    await usernameInput.fill(username);
    await passwordInput.fill(password);
    await loginButton.click();
  }

  /**
   * Wait for successful login by verifying the login response and session cookie.
   * Call this after loginWithCredentials to ensure authentication completed.
   *
   * This does NOT assume a specific landing page (which is configurable).
   * Instead it:
   * 1. Checks if session cookie already exists (guards against race condition)
   * 2. Waits for POST /login/ response with redirect status
   * 3. Polls for session cookie to appear
   *
   * @param options - Optional wait options
   */
  async waitForLoginSuccess(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;
    const startTime = Date.now();

    // 1. Guard: Check if session cookie already exists (race condition protection)
    const existingCookie = await this.getSessionCookie();
    if (existingCookie?.value) {
      // Already authenticated - login completed before we started waiting
      return;
    }

    // 2. Wait for POST /login/ response (bounded by caller's timeout)
    const loginResponse = await this.page.waitForResponse(
      response =>
        response.url().includes('/login/') &&
        response.request().method() === 'POST',
      { timeout },
    );

    // 3. Verify it's a redirect (3xx status code indicates successful login)
    const status = loginResponse.status();
    if (status < 300 || status >= 400) {
      throw new Error(`Login failed: expected redirect (3xx), got ${status}`);
    }

    // 4. Poll for session cookie to appear (HttpOnly cookie, not accessible via document.cookie)
    // Use page.context().cookies() since session cookie is HttpOnly
    const pollInterval = 500; // 500ms instead of 100ms for less chattiness
    while (true) {
      const remaining = timeout - (Date.now() - startTime);
      if (remaining <= 0) {
        break; // Timeout exceeded
      }

      const sessionCookie = await this.getSessionCookie();
      if (sessionCookie && sessionCookie.value) {
        // Success - session cookie has landed
        return;
      }

      await this.page.waitForTimeout(Math.min(pollInterval, remaining));
    }

    const currentUrl = await this.page.url();
    throw new Error(
      `Login timeout: session cookie did not appear within ${timeout}ms. Current URL: ${currentUrl}`,
    );
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Get the session cookie specifically
   */
  async getSessionCookie(): Promise<Cookie | null> {
    const cookies = await this.page.context().cookies();
    return cookies.find(c => c.name === 'session') || null;
  }

  /**
   * Check if login form has validation errors
   */
  async hasLoginError(): Promise<boolean> {
    const visibilityPromises = AuthPage.SELECTORS.ERROR_SELECTORS.map(
      selector => this.page.locator(selector).isVisible(),
    );
    const visibilityResults = await Promise.all(visibilityPromises);
    return visibilityResults.some(isVisible => isVisible);
  }

  /**
   * Wait for a login request to be made and return the response
   */
  async waitForLoginRequest(): Promise<Response> {
    return this.page.waitForResponse(
      response =>
        response.url().includes('/login/') &&
        response.request().method() === 'POST',
    );
  }
}
