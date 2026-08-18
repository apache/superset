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

/**
 * Parses time ratio from string or number
 */
export function parseTimeRatio(timeRatio: string | number): number {
  return typeof timeRatio === 'string' ? parseInt(timeRatio, 10) : timeRatio;
}

/**
 * Transforms entries into time ratio sparkline data
 */
export function transformTimeRatioData(
  entries: Entry[],
  valueField: string,
  timeRatio: number,
): (number | null)[] {
  const sparkData: (number | null)[] = [];

  for (let i = timeRatio; i < entries.length; i += 1) {
    const prevData = entries[i - timeRatio][valueField];
    if (prevData && prevData !== 0) {
      sparkData.push(entries[i][valueField] / prevData);
    } else {
      sparkData.push(null);
    }
  }

  return sparkData;
}

/**
 * Transforms entries into regular sparkline data
 */
export function transformRegularData(
  entries: Entry[],
  valueField: string,
): (number | null)[] {
  return entries.map(d => d[valueField]);
}

/**
 * Transforms entries into sparkline data based on column configuration
 */
export function transformSparklineData(
  valueField: string,
  column: ColumnConfig,
  entries: Entry[],
): (number | null)[] {
  if (column.timeRatio) {
    const timeRatio = parseTimeRatio(column.timeRatio);
    return transformTimeRatioData(entries, valueField, timeRatio);
  }

  return transformRegularData(entries, valueField);
}

/**
 * Parses dimension values with defaults
 */
export function parseSparklineDimensions(column: ColumnConfig) {
  return {
    width: parseInt(column.width || '300', 10),
    height: parseInt(column.height || '50', 10),
  };
}

/**
 * Validates and formats y-axis bounds
 */
export function validateYAxisBounds(
  yAxisBounds: unknown,
): [number | undefined, number | undefined] {
  if (Array.isArray(yAxisBounds) && yAxisBounds.length === 2)
    return yAxisBounds as [number | undefined, number | undefined];

  return [undefined, undefined];
}
