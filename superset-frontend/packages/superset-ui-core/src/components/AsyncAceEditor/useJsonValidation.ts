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
import { useMemo } from 'react';

export interface JsonValidationAnnotation {
  type: 'error' | 'warning' | 'info';
  row: number;
  column: number;
  text: string;
}

export interface UseJsonValidationOptions {
  /** Whether to enable JSON validation. Default: true */
  enabled?: boolean;
  /** Custom error message prefix. Default: 'Invalid JSON' */
  errorPrefix?: string;
}

/**
 * Hook for JSON validation that returns AceEditor-compatible annotations.
 * Based on the SQL Lab validation pattern.
 *
 * @param jsonValue - The JSON string to validate
 * @param options - Validation options
 * @returns Array of annotation objects for AceEditor
 */
export function useJsonValidation(
  jsonValue?: string,
  options: UseJsonValidationOptions = {},
): JsonValidationAnnotation[] {
  const { enabled = true, errorPrefix = 'Invalid JSON' } = options;

  return useMemo(() => {
    // Skip validation if disabled or empty value
    if (!enabled || !jsonValue?.trim()) {
      return [];
    }

    try {
      JSON.parse(jsonValue);
      return []; // Valid JSON - no annotations
    } catch (error: any) {
      const errorMessage = error.message || 'syntax error';

      return [
        {
          type: 'error' as const,
          row: 0, // JSON parse errors don't provide reliable line numbers
          column: 0,
          text: `${errorPrefix}: ${errorMessage}`,
        },
      ];
    }
  }, [enabled, jsonValue, errorPrefix]);
}
