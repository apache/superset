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
import { useMemo, useState, useEffect } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import type { JsonValidationAnnotation } from '@superset-ui/core/components/AsyncAceEditor';
import type { AnyThemeConfig } from '@superset-ui/core/theme/types';
import {
  validateThemeTokens,
  formatValidationErrors,
} from '../utils/themeTokenValidation';

/**
 * Find the line number where a specific token appears in JSON string
 * Uses improved logic to handle nested objects and avoid false positives
 */
function findTokenLineInJson(jsonString: string, tokenName: string): number {
  if (!jsonString || !tokenName) {
    return 0;
  }

  const lines = jsonString.split('\n');

  // Look for the token name as a JSON property key
  const searchPattern = `"${tokenName}"`;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    // Check if this line contains our token as a property key
    // Pattern: "tokenName" followed by : (with possible whitespace)
    const propertyPattern = new RegExp(
      `"${tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`,
    );

    if (propertyPattern.test(line)) {
      return i; // Return 0-based line number for AceEditor
    }
  }

  // Fallback: simple string search for edge cases
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(searchPattern)) {
      return i;
    }
  }

  // If token not found, return line 0
  return 0;
}

export interface ThemeValidationResult {
  annotations: JsonValidationAnnotation[];
  hasErrors: boolean;
  hasWarnings: boolean;
  validTokenCount: number;
  invalidTokenCount: number;
  errorMessages: string[];
}

export interface UseThemeValidationOptions {
  /** Whether to enable validation. Default: true */
  enabled?: boolean;
  /** Custom error message prefix for JSON syntax errors. Default: 'Invalid JSON syntax' */
  jsonErrorPrefix?: string;
  /** Custom error message prefix for theme token errors. Default: 'Invalid theme token' */
  tokenErrorPrefix?: string;
  /** Theme name for error messages */
  themeName?: string;
  /** Debounce delay in milliseconds for validation. Default: 300 */
  debounceMs?: number;
}

/**
 * Enhanced theme validation hook that combines JSON syntax validation with theme token validation.
 * Uses feature flag to enable/disable enhanced token validation.
 *
 * @param jsonValue - The JSON string to validate
 * @param options - Validation options
 * @returns Enhanced validation result with annotations and metadata
 */
export function useThemeValidation(
  jsonValue?: string,
  options: UseThemeValidationOptions = {},
): ThemeValidationResult {
  const {
    enabled = true,
    jsonErrorPrefix = 'Invalid JSON syntax',
    tokenErrorPrefix = 'Invalid theme token',
    themeName,
    debounceMs = 300,
  } = options;

  // Debounced JSON value for validation
  const [debouncedJsonValue, setDebouncedJsonValue] = useState(jsonValue);

  // Debounce the JSON value to avoid excessive validation calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedJsonValue(jsonValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [jsonValue, debounceMs]);

  // Get basic JSON validation annotations
  const jsonAnnotations = useJsonValidation(jsonValue, {
    enabled,
    errorPrefix: jsonErrorPrefix,
  });

  // Enhanced theme token validation (feature flag controlled)
  const enhancedValidation = useMemo(() => {
    // Skip if basic validation is disabled or JSON has syntax errors
    if (!enabled || jsonAnnotations.length > 0 || !debouncedJsonValue?.trim()) {
      return {
        annotations: [],
        validTokenCount: 0,
        invalidTokenCount: 0,
        errorMessages: [],
      };
    }

    // Only run enhanced validation if feature flag is enabled
    try {
      const isEnabled = isFeatureEnabled(FeatureFlag.EnhancedThemeValidation);
      if (!isEnabled) {
        return {
          annotations: [],
          validTokenCount: 0,
          invalidTokenCount: 0,
          errorMessages: [],
        };
      }
    } catch (error) {
      // Feature flag check failed - assume disabled
      return {
        annotations: [],
        validTokenCount: 0,
        invalidTokenCount: 0,
        errorMessages: [],
      };
    }

    try {
      const themeConfig: AnyThemeConfig = JSON.parse(debouncedJsonValue);

      // Additional null safety check
      if (!themeConfig || typeof themeConfig !== 'object') {
        return {
          annotations: [],
          validTokenCount: 0,
          invalidTokenCount: 0,
          errorMessages: [],
        };
      }

      const validationResult = validateThemeTokens(themeConfig);

      const errorMessages = formatValidationErrors(
        validationResult.errors,
        themeName,
      );

      // Convert validation errors to AceEditor annotations with line mapping
      const tokenAnnotations: JsonValidationAnnotation[] =
        validationResult.errors.map(error => {
          // Find the line where this token appears in the JSON
          const tokenLine = findTokenLineInJson(
            debouncedJsonValue,
            error.tokenName,
          );

          return {
            type: 'warning' as const, // Use warnings so users can still save
            row: tokenLine,
            column: 0,
            text: `${tokenErrorPrefix}: ${error.message}`,
          };
        });

      return {
        annotations: tokenAnnotations,
        validTokenCount: Object.keys(validationResult.validTokens || {}).length,
        invalidTokenCount: Object.keys(validationResult.invalidTokens || {})
          .length,
        errorMessages,
      };
    } catch (error) {
      // JSON parsing error should be caught by jsonAnnotations
      return {
        annotations: [],
        validTokenCount: 0,
        invalidTokenCount: 0,
        errorMessages: [],
      };
    }
  }, [
    enabled,
    debouncedJsonValue,
    jsonAnnotations,
    tokenErrorPrefix,
    themeName,
  ]);

  return useMemo(() => {
    const allAnnotations = [
      ...jsonAnnotations,
      ...enhancedValidation.annotations,
    ];

    return {
      annotations: allAnnotations,
      hasErrors: jsonAnnotations.some(ann => ann.type === 'error'),
      hasWarnings: allAnnotations.some(ann => ann.type === 'warning'),
      validTokenCount: enhancedValidation.validTokenCount,
      invalidTokenCount: enhancedValidation.invalidTokenCount,
      errorMessages: enhancedValidation.errorMessages,
    };
  }, [jsonAnnotations, enhancedValidation]);
}

/**
 * Helper hook to check if enhanced theme validation is enabled
 */
export function useIsEnhancedValidationEnabled(): boolean {
  return useMemo(() => {
    try {
      return isFeatureEnabled(FeatureFlag.EnhancedThemeValidation);
    } catch (error) {
      // Feature flag check failed - assume disabled
      return false;
    }
  }, []);
}
