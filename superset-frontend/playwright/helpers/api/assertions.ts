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

import type { Response, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Common interface for response types with status() method.
 * Supports both Response (network interception) and APIResponse (page.request API).
 */
type ResponseLike = Response | APIResponse;

/**
 * Verify response has exact status code
 * @param response - Playwright Response or APIResponse object
 * @param expected - Expected status code
 * @returns The response for chaining
 */
export function expectStatus<T extends ResponseLike>(
  response: T,
  expected: number,
): T {
  expect(
    response.status(),
    `Expected status ${expected}, got ${response.status()}`,
  ).toBe(expected);
  return response;
}

/**
 * Verify response status code is one of the expected values
 * @param response - Playwright Response or APIResponse object
 * @param expected - Array of acceptable status codes
 * @returns The response for chaining
 */
export function expectStatusOneOf<T extends ResponseLike>(
  response: T,
  expected: number[],
): T {
  expect(
    expected,
    `Expected status to be one of ${expected.join(', ')}, got ${response.status()}`,
  ).toContain(response.status());
  return response;
}
