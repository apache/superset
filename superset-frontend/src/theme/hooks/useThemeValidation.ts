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
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import type { JsonValidationAnnotation } from '@superset-ui/core/components/AsyncAceEditor';
import type { AnyThemeConfig } from '@apache-superset/core/ui';
import { validateTheme } from '../utils/themeStructureValidation';

/**
 * Find the line number where a specific token appears in JSON string.
 * Uses improved logic to handle nested objects and avoid false positives.
 */
function findTokenLineInJson(jsonString: string, tokenName: string): number {
  if (!jsonString || !tokenName) {
    return 0;
  }

  // Handle special _root token for structural errors
  if (tokenName === '_root') {
    return 0;
  }

  const lines = jsonString.split('\n');

  // Look for the token name as a JSON property key
  // Pattern: "tokenName" followed by : (with possible whitespace)
  const propertyPattern = new RegExp(
    `"${tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`,
  );

  for (let i = 0; i < lines.length; i += 1) {
    if (propertyPattern.test(lines[i].trim())) {
      return i; // Return 0-based line number for AceEditor
    }
  }

  // Fallback: simple string search for edge cases
  const searchPattern = `"${tokenName}"`;
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
  hasErrors: boolean; // true if errors exist (blocks save)
  hasWarnings: boolean; // true if warnings exist (non-blocking)
}

export interface UseThemeValidationOptions {
  /** Whether to enable validation. Default: true */
  enabled?: boolean;
  /** Debounce delay in milliseconds for validation. Default: 300 */
  debounceMs?: number;
}

/**
 * Theme validation hook with live feedback.
 * - Errors (JSON syntax, empty theme) block save/apply
 * - Warnings (unknown tokens, null values) allow save/apply
 *
 * This hook validates structure and token names only.
 * Token values are validated by Ant Design at runtime.
 */
export function useThemeValidation(
  jsonValue?: string,
  options: UseThemeValidationOptions = {},
): ThemeValidationResult {
  const { enabled = true, debounceMs = 300 } = options;

  const [debouncedValue, setDebouncedValue] = useState(jsonValue);

  // Debounce for performance
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(jsonValue), debounceMs);
    return () => clearTimeout(timer);
  }, [jsonValue, debounceMs]);

  // JSON syntax validation (ERRORS)
  const jsonAnnotations = useJsonValidation(debouncedValue, {
    enabled,
    errorPrefix: 'Invalid JSON',
  });

  // Theme structure validation (ERRORS + WARNINGS)
  const themeAnnotations = useMemo(() => {
    // Skip if disabled or JSON is invalid
    if (!enabled || jsonAnnotations.length > 0 || !debouncedValue?.trim()) {
      return [];
    }

    try {
      const config: AnyThemeConfig = JSON.parse(debouncedValue);
      const result = validateTheme(config);

      const annotations: JsonValidationAnnotation[] = [];

      // Convert errors to annotations (blocks save)
      result.errors.forEach(issue => {
        annotations.push({
          type: 'error',
          row: findTokenLineInJson(debouncedValue, issue.tokenName),
          column: 0,
          text: issue.message,
        });
      });

      // Convert warnings to annotations (non-blocking)
      result.warnings.forEach(issue => {
        annotations.push({
          type: 'warning',
          row: findTokenLineInJson(debouncedValue, issue.tokenName),
          column: 0,
          text: issue.message,
        });
      });

      return annotations;
    } catch {
      // JSON parsing error already caught by jsonAnnotations
      return [];
    }
  }, [enabled, debouncedValue, jsonAnnotations]);

  return useMemo(() => {
    const allAnnotations = [...jsonAnnotations, ...themeAnnotations];

    return {
      annotations: allAnnotations,
      hasErrors: allAnnotations.some(a => a.type === 'error'),
      hasWarnings: allAnnotations.some(a => a.type === 'warning'),
    };
  }, [jsonAnnotations, themeAnnotations]);
}
