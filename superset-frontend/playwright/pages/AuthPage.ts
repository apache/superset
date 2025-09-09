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
    await this.page.goto(URL.LOGIN);
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginForm(): Promise<void> {
    await this.loginForm.waitForVisible();
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
    return cookies.find(c => c.name === 'session') || null;
  }

  /**
   * Check if user is logged in (redirected away from login page)
   */
  async isLoggedIn(): Promise<boolean> {
    const url = await this.getCurrentUrl();
    return !url.includes('/login');
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
   * Get login error message if present
   */
  async getLoginErrorMessage(): Promise<string | null> {
    const errorLocators = AuthPage.SELECTORS.ERROR_SELECTORS.map(selector =>
      this.page.locator(selector).first(),
    );

    const visibilityResults = await Promise.all(
      errorLocators.map(locator => locator.isVisible()),
    );

    const visibleIndex = visibilityResults.findIndex(isVisible => isVisible);
    if (visibleIndex !== -1) {
      return errorLocators[visibleIndex].textContent();
    }

    return null;
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
