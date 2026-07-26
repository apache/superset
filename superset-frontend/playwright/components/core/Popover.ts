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

import { Locator, Page } from '@playwright/test';
import { Button } from './Button';

/**
 * Ant Design Popover component.
 */
export class Popover {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator?: Locator) {
    this.page = page;
    this.locator = locator ?? page.locator('.ant-popover-content');
  }

  get element(): Locator {
    return this.locator;
  }

  async waitForVisible(options?: { timeout?: number }): Promise<void> {
    await this.locator.waitFor({ state: 'visible', ...options });
  }

  async waitForHidden(options?: { timeout?: number }): Promise<void> {
    await this.locator.waitFor({ state: 'hidden', ...options });
  }

  getButton(name: string): Button {
    return new Button(
      this.page,
      this.locator.getByRole('button', { name, exact: true }),
    );
  }
}
