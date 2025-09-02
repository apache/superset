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

import type { ColumnConfig, Entry } from '../../types';

export interface ValueCalculationResult {
  value: number | null;
  errorMsg?: string;
}

/**
 * Calculates time-based values with lag and comparison types
 */
export function calculateTimeValue(
  recent: number | null,
  valueField: string,
  reversedEntries: Entry[],
  column: ColumnConfig,
): ValueCalculationResult {
  const timeLag = column.timeLag || 0;
  const totalLag = reversedEntries.length;

  if (Math.abs(timeLag) >= totalLag)
    return {
      value: null,
      errorMsg: `The time lag set at ${timeLag} is too large for the length of data at ${reversedEntries.length}. No data available.`,
    };

  let laggedValue: number | null;

  if (timeLag < 0)
    laggedValue = reversedEntries[totalLag + timeLag][valueField];
  else laggedValue = reversedEntries[timeLag][valueField];

  if (typeof laggedValue !== 'number' || typeof recent !== 'number')
    return { value: null };

  let calculatedValue: number;

  if (column.comparisonType === 'diff') calculatedValue = recent - laggedValue;
  else if (column.comparisonType === 'perc')
    calculatedValue = recent / laggedValue;
  else if (column.comparisonType === 'perc_change')
    calculatedValue = recent / laggedValue - 1;
  else calculatedValue = laggedValue;

  return { value: calculatedValue };
}

/**
 * Calculates contribution value (percentage of total)
 */
export function calculateContribution(
  recent: number | null,
  reversedEntries: Entry[],
): ValueCalculationResult {
  if (typeof recent !== 'number' || reversedEntries.length === 0)
    return { value: null };

  const firstEntry = reversedEntries[0];
  let total = 0;

  Object.keys(firstEntry).forEach(k => {
    if (k !== 'time' && typeof firstEntry[k] === 'number')
      total += firstEntry[k];
  });

  if (total === 0) return { value: null };

  return { value: recent / total };
}

/**
 * Calculates average value over a time period
 */
export function calculateAverage(
  valueField: string,
  reversedEntries: Entry[],
  column: ColumnConfig,
): ValueCalculationResult {
  if (reversedEntries.length === 0) return { value: null };

  const sliceEnd = column.timeLag || reversedEntries.length;
  let count = 0;
  let sum = 0;

  for (let i = 0; i < sliceEnd && i < reversedEntries.length; i += 1) {
    const value = reversedEntries[i][valueField];

    if (value !== undefined && value !== null) {
      count += 1;
      sum += value;
    }
  }

  if (count === 0) return { value: null };

  return { value: sum / count };
}

/**
 * Calculates cell values based on column type
 */
export function calculateCellValue(
  valueField: string,
  column: ColumnConfig,
  reversedEntries: Entry[],
): ValueCalculationResult {
  if (reversedEntries.length === 0) return { value: null };

  const recent = reversedEntries[0][valueField];

  if (column.colType === 'time')
    return calculateTimeValue(recent, valueField, reversedEntries, column);

  if (column.colType === 'contrib')
    return calculateContribution(recent, reversedEntries);

  if (column.colType === 'avg')
    return calculateAverage(valueField, reversedEntries, column);

  return { value: recent };
}
