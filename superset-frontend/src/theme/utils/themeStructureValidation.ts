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

  // WARNING: Unknown token names (likely typos)
  // Guard against non-object token values (e.g., string, array, number)
  const rawToken = themeConfig.token;
  const tokens =
    rawToken && typeof rawToken === 'object' && !Array.isArray(rawToken)
      ? rawToken
      : {};

  if (rawToken && tokens !== rawToken) {
    errors.push({
      tokenName: '_root',
      severity: 'error',
      message:
        'Token configuration must be an object, not an array or primitive',
    });
    return { valid: false, errors, warnings };
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
