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
 * Base timestamp used for test data generation.
 * This provides a consistent starting point for all test timestamps.
 */
export const BASE_TIMESTAMP = 599616000000;

/**
 * Default interval between timestamps (300000000 ms ≈ 3.47 days).
 * This matches the common pattern used in tests.
 */
export const DEFAULT_TIMESTAMP_INTERVAL = 300000000;

/**
 * Creates a timestamp with an offset from the base timestamp.
 *
 * @param offset - Offset in milliseconds from BASE_TIMESTAMP
 * @returns Timestamp value
 */
export function createTimestamp(offset: number = 0): number {
  return BASE_TIMESTAMP + offset;
}

/**
 * Creates an array of timestamps starting from the base timestamp.
 *
 * @param count - Number of timestamps to generate
 * @param intervalMs - Interval between timestamps in milliseconds (default: DEFAULT_TIMESTAMP_INTERVAL)
 * @returns Array of timestamp values
 */
export function createTimestamps(
  count: number,
  intervalMs: number = DEFAULT_TIMESTAMP_INTERVAL,
): number[] {
  return Array.from({ length: count }, (_, index) =>
    createTimestamp(index * intervalMs),
  );
}

/**
 * Creates a single test data row with a timestamp.
 *
 * @param values - Object containing series values (excluding __timestamp)
 * @param timestamp - Timestamp value to include
 * @returns Test data row with __timestamp property
 */
export function createTestDataRow(
  values: Record<string, number>,
  timestamp: number,
): Record<string, number> & { __timestamp: number } {
  return {
    ...values,
    __timestamp: timestamp,
  };
}

/**
 * Options for creating test data.
 */
export interface CreateTestDataOptions {
  /** Base timestamp to start from (default: BASE_TIMESTAMP) */
  baseTimestamp?: number;
  /** Interval between timestamps in milliseconds (default: DEFAULT_TIMESTAMP_INTERVAL) */
  intervalMs?: number;
}

/**
 * Creates an array of test data rows with auto-generated timestamps.
 *
 * @param rows - Array of objects containing series values (without __timestamp)
 * @param options - Options for timestamp generation
 * @returns Array of test data rows with __timestamp properties
 *
 * @example
 * ```typescript
 * const data = createTestData(
 *   [
 *     { 'Series A': 15000 },
 *     { 'Series A': 20000 },
 *     { 'Series A': 18000 },
 *   ],
 *   { intervalMs: 300000000 }
 * );
 * // Returns:
 * // [
 * //   { 'Series A': 15000, __timestamp: 599616000000 },
 * //   { 'Series A': 20000, __timestamp: 599916000000 },
 * //   { 'Series A': 18000, __timestamp: 600216000000 },
 * // ]
 * ```
 */
export function createTestData(
  rows: Array<Record<string, number>>,
  options: CreateTestDataOptions = {},
): Array<Record<string, number> & { __timestamp: number }> {
  const {
    baseTimestamp = BASE_TIMESTAMP,
    intervalMs = DEFAULT_TIMESTAMP_INTERVAL,
  } = options;

  return rows.map((row, index) =>
    createTestDataRow(row, baseTimestamp + index * intervalMs),
  );
}
