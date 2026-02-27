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
import type { AnyThemeConfig } from '@apache-superset/core/ui';
import { isValidTokenName } from './antdTokenNames';

/**
 * Valid algorithm values that match backend ThemeMode enum.
 * These correspond to Ant Design's built-in theme algorithms.
 */
const VALID_ALGORITHM_VALUES = new Set([
  'default',
  'dark',
  'system',
  'compact',
]);

export interface ValidationIssue {
  tokenName: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean; // false if ANY errors exist (warnings don't affect this)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Validates theme structure and token names.
 * - ERRORS block save/apply (invalid structure, empty themes)
 * - WARNINGS allow save/apply but show in editor (unknown tokens, null values)
 *
 * This validation does NOT check token values - Ant Design handles that at runtime.
 */
export function validateTheme(themeConfig: AnyThemeConfig): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ERROR: Null/invalid config
  if (!themeConfig || typeof themeConfig !== 'object') {
    errors.push({
      tokenName: '_root',
      severity: 'error',
      message: 'Theme configuration must be a valid object',
    });
    return { valid: false, errors, warnings };
  }

  // ERROR: Empty theme (no tokens, no algorithm, no components)
  const hasTokens =
    themeConfig.token && Object.keys(themeConfig.token).length > 0;
  const hasAlgorithm = Boolean(themeConfig.algorithm);
  const hasComponents =
    themeConfig.components && Object.keys(themeConfig.components).length > 0;

  if (!hasTokens && !hasAlgorithm && !hasComponents) {
    errors.push({
      tokenName: '_root',
      severity: 'error',
      message:
        'Theme cannot be empty. Add at least one token, algorithm, or component override.',
    });
    return { valid: false, errors, warnings };
  }

  // ERROR: token must be an object if present (null is also rejected by backend)
  const rawToken = themeConfig.token;
  if (rawToken !== undefined) {
    if (
      rawToken === null ||
      typeof rawToken !== 'object' ||
      Array.isArray(rawToken)
    ) {
      errors.push({
        tokenName: '_root',
        severity: 'error',
        message:
          'Token configuration must be an object, not null, array, or primitive',
      });
      return { valid: false, errors, warnings };
    }
  }
  const tokens = rawToken ?? {};

  // ERROR: components must be an object if present (null is also rejected by backend)
  const rawComponents = themeConfig.components;
  if (rawComponents !== undefined) {
    if (
      rawComponents === null ||
      typeof rawComponents !== 'object' ||
      Array.isArray(rawComponents)
    ) {
      errors.push({
        tokenName: '_root',
        severity: 'error',
        message:
          'Components configuration must be an object, not null, array, or primitive',
      });
      return { valid: false, errors, warnings };
    }
  }

  // ERROR: algorithm must be a valid string or array of valid strings if present
  // Valid values: "default", "dark", "system", "compact" (matches backend ThemeMode)
  const rawAlgorithm = themeConfig.algorithm;
  if (rawAlgorithm !== undefined) {
    // Null is rejected by backend
    if (rawAlgorithm === null) {
      errors.push({
        tokenName: '_root',
        severity: 'error',
        message: 'Algorithm cannot be null',
      });
      return { valid: false, errors, warnings };
    }

    // Must be string or array of strings
    const isString = typeof rawAlgorithm === 'string';
    const isStringArray =
      Array.isArray(rawAlgorithm) &&
      rawAlgorithm.every(a => typeof a === 'string');

    if (!isString && !isStringArray) {
      errors.push({
        tokenName: '_root',
        severity: 'error',
        message:
          'Algorithm must be a string or array of strings (e.g., "dark" or ["dark", "compact"])',
      });
      return { valid: false, errors, warnings };
    }

    // Validate algorithm values against allowed set
    const algorithms = isString ? [rawAlgorithm] : (rawAlgorithm as string[]);
    const invalidAlgorithms = algorithms.filter(
      a => !VALID_ALGORITHM_VALUES.has(a),
    );
    if (invalidAlgorithms.length > 0) {
      errors.push({
        tokenName: '_root',
        severity: 'error',
        message: `Invalid algorithm value(s): "${invalidAlgorithms.join('", "')}". Valid values are: default, dark, system, compact`,
      });
      return { valid: false, errors, warnings };
    }
  }

  Object.entries(tokens).forEach(([name, value]) => {
    // Null/undefined check
    if (value === null || value === undefined) {
      warnings.push({
        tokenName: name,
        severity: 'warning',
        message: `Token '${name}' has null/undefined value`,
      });
      return;
    }

    // Token name validation
    if (!isValidTokenName(name)) {
      warnings.push({
        tokenName: name,
        severity: 'warning',
        message: `Unknown token '${name}' - may be ignored by Ant Design`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
