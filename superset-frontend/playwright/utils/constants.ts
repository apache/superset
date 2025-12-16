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

/**
 * Timeout constants for Playwright tests.
 * Only define timeouts that differ from Playwright defaults or are semantically important.
 *
 * Default Playwright timeouts (from playwright.config.ts):
 * - Test timeout: 30000ms (30s)
 * - Expect timeout: 8000ms (8s)
 *
 * Use these constants instead of magic numbers for better maintainability.
 */

export const TIMEOUT = {
  /**
   * Global setup timeout (matches test timeout for cold CI starts)
   */
  GLOBAL_SETUP: 30000, // 30s for global setup auth

  /**
   * Page navigation and load timeouts
   */
  PAGE_LOAD: 10000, // 10s for page transitions (login → welcome, dataset → explore)

  /**
   * Form and UI element load timeouts
   */
  FORM_LOAD: 5000, // 5s for forms to become visible (login form, modals)
} as const;
