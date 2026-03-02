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
 * Accessibility Test Helper
 *
 * Shared utilities for axe-core based a11y testing.
 * Uses jest-axe to run automated WCAG 2.1 Level A+AA checks.
 */
import { configureAxe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// WCAG 2.1 Level A + AA rules relevant to our 15 criteria
export const WCAG_RULES = [
  'image-alt', // 1.1.1
  'button-name', // 1.1.1
  'aria-toggle-field-name', // 1.3.3
  'link-in-text-block', // 1.4.1
  'color-contrast', // 1.4.11
  'label', // 2.4.6
  'autocomplete-valid', // 1.3.5
  'heading-order', // 2.4.6
  'aria-required-attr', // general
  'aria-valid-attr', // general
  'aria-valid-attr-value', // general
] as const;

export const axeConfig = configureAxe({
  rules: {
    // Focus on WCAG 2.1 A + AA
    region: { enabled: false }, // Not in our 15 criteria scope
  },
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa'],
  },
});

/**
 * Run axe-core accessibility checks on a rendered container.
 * Returns the full axe results object for assertion.
 */
export async function checkA11y(container: HTMLElement) {
  const results = await axeConfig(container);
  return results;
}

/**
 * Helper to format axe violations into a readable string for test output.
 */
export function formatViolations(violations: any[]) {
  return violations
    .map(
      (v: any) =>
        `[${v.id}] ${v.description} (${v.impact}): ${v.nodes.length} instance(s)`,
    )
    .join('\n');
}
