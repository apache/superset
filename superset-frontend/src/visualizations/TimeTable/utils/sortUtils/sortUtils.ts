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
 * Simple numeric value comparison that handles null, undefined, and mixed types
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param nanTreatment - How to treat NaN values
 * @returns Numeric comparison result
 */
function compareValues(
  a: any,
  b: any,
  nanTreatment: 'asSmallest' | 'asLargest' | 'alwaysLast' = 'asSmallest',
): number {
  const numA = typeof a === 'string' ? parseFloat(a) : a;
  const numB = typeof b === 'string' ? parseFloat(b) : b;

  const isAValid = numA !== null && numA !== undefined && !Number.isNaN(numA);
  const isBValid = numB !== null && numB !== undefined && !Number.isNaN(numB);

  if (!isAValid && !isBValid) return 0;
  if (!isAValid) return nanTreatment === 'asSmallest' ? -1 : 1;
  if (!isBValid) return nanTreatment === 'asSmallest' ? 1 : -1;

  return numA - numB;
}

/**
 * Sorts table rows with mixed data types for react-table
 * @param rowA - First row to compare
 * @param rowB - Second row to compare
 * @param columnId - Column identifier for sorting
 * @param descending - Whether to sort in descending order
 * @returns Numeric comparison result for react-table
 */
export function sortNumberWithMixedTypes(
  rowA: any,
  rowB: any,
  columnId: string,
  descending: boolean,
) {
  const valueA = rowA.values[columnId].props['data-value'];
  const valueB = rowB.values[columnId].props['data-value'];

  const comparison = compareValues(valueA, valueB, 'asSmallest');

  return comparison * (descending ? -1 : 1);
}
