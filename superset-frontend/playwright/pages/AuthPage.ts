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

import { Page } from '@playwright/test';
import { Form } from '../components/core';
import { LOGIN, LOGIN_REQUEST_PATTERN } from '../utils/urls';

export class AuthPage {
  private readonly page: Page;

  private readonly loginForm: Form;

  // Selectors specific to the auth/login page
  private static readonly SELECTORS = {
    LOGIN_FORM: '[data-test="login-form"]',
    USERNAME_INPUT: '[data-test="username-input"]',
    PASSWORD_INPUT: '[data-test="password-input"]',
    LOGIN_BUTTON: '[data-test="login-button"]',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.loginForm = new Form(page, AuthPage.SELECTORS.LOGIN_FORM);
  }

  /**
   * Navigate to the login page
   */
  async goto(): Promise<void> {
    await this.page.goto(LOGIN);
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginForm(): Promise<void> {
    await this.loginForm.waitForVisible();
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible(): Promise<boolean> {
    return this.loginForm.isVisible();
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
   * Get all cookies from the current context
   */
  async getCookies(): Promise<
    Array<{ name: string; value: string; domain: string }>
  > {
    return this.page.context().cookies();
  }

  /**
   * Wait for a login request to be made
   */
  async waitForLoginRequest(): Promise<void> {
    await this.page.waitForRequest(LOGIN_REQUEST_PATTERN);
  }
}
