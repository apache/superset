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
import { Form } from '../components/core';
import { URL } from '../utils/urls';

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
    console.log('=== PLAYWRIGHT DEBUG START ===');
    console.log('Navigating to URL:', URL.LOGIN);
    console.log('Current baseURL:', this.page.context().options.baseURL);

    const response = await this.page.goto(URL.LOGIN);

    console.log('Final URL after navigation:', this.page.url());
    console.log('Response status:', response?.status());
    console.log('Response headers:', await response?.allHeaders());

    // Check for redirects
    const expectedUrl = `${this.page.context().options.baseURL}${URL.LOGIN}`;
    if (this.page.url() !== expectedUrl) {
      console.log('REDIRECT DETECTED!');
      console.log('Expected:', expectedUrl);
      console.log('Actual:', this.page.url());
    }

    // Wait a bit for any dynamic content
    await this.page.waitForTimeout(2000);

    // Check page content
    const content = await this.page.content();
    const hasLoginForm = content.includes('data-test="login-form"');
    console.log('Login form found in DOM:', hasLoginForm);

    if (!hasLoginForm) {
      console.log('Page title:', await this.page.title());
      console.log('Page content length:', content.length);

      // Log first 1000 chars of content to see what we got
      console.log('Page content preview:', content.substring(0, 1000));

      // Check for common error patterns
      if (content.includes('404') || content.includes('Not Found')) {
        console.error('ERROR: Page returned 404!');
      }
      if (
        content.includes('500') ||
        content.includes('Internal Server Error')
      ) {
        console.error('ERROR: Page returned 500!');
      }

      // Check if static assets are loading
      const failedRequests: string[] = [];
      this.page.on('requestfailed', (request: any) => {
        failedRequests.push(
          `${request.url()} - ${request.failure()?.errorText}`,
        );
      });

      // Log any JavaScript errors
      this.page.on('pageerror', (error: any) => {
        console.error('JavaScript error:', error.message);
      });

      // Take a screenshot for debugging
      await this.page.screenshot({
        path: 'playwright-results/debug-login-page.png',
        fullPage: true,
      });
      console.log(
        'Debug screenshot saved to playwright-results/debug-login-page.png',
      );

      if (failedRequests.length > 0) {
        console.error('Failed requests:', failedRequests);
      }
    }

    console.log('=== PLAYWRIGHT DEBUG END ===');
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginForm(): Promise<void> {
    try {
      await this.loginForm.waitForVisible({ timeout: 5000 });
    } catch (error) {
      console.error('Login form wait timeout after 5 seconds');
      // Take another screenshot at timeout
      await this.page.screenshot({
        path: 'playwright-results/timeout-login-form.png',
        fullPage: true,
      });
      throw error;
    }
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
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Get the session cookie specifically
   */
  async getSessionCookie(): Promise<{ name: string; value: string } | null> {
    const cookies = await this.page.context().cookies();
    return cookies.find((c: any) => c.name === 'session') || null;
  }

  /**
   * Check if login form has validation errors
   */
  async hasLoginError(): Promise<boolean> {
    const visibilityPromises = AuthPage.SELECTORS.ERROR_SELECTORS.map(
      selector => this.page.locator(selector).isVisible(),
    );
    const visibilityResults = await Promise.all(visibilityPromises);
    return visibilityResults.some((isVisible: any) => isVisible);
  }

  /**
   * Wait for a login request to be made and return the response
   */
  async waitForLoginRequest(): Promise<Response> {
    return this.page.waitForResponse(
      (response: any) =>
        response.url().includes('/login/') &&
        response.request().method() === 'POST',
    );
  }
}
