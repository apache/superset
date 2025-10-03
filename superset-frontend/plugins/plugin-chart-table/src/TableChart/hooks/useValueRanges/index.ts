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
import { useMemo, useCallback } from 'react';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import { DataRecord } from '@superset-ui/core';
import { DataColumnMeta } from '../../../types';
import { ValueRange } from '../../constants';

export interface UseValueRangesReturn {
  valueRanges: Record<
    string,
    { aligned: ValueRange; normal: ValueRange } | null
  >;
  getValueRange: (
    key: string,
    alignPositiveNegative: boolean,
  ) => ValueRange | null;
}

/**
 * Pre-calculates value ranges for all metric columns to avoid O(n×m) complexity
 * on every render. Returns both the cached ranges and a getter function.
 */
export function useValueRanges(
  data: DataRecord[],
  filteredColumnsMeta: DataColumnMeta[],
): UseValueRangesReturn {
  // Pre-calculate value ranges for all metric columns to avoid O(n*m) complexity
  const valueRanges = useMemo(() => {
    const ranges: Record<
      string,
      { aligned: ValueRange; normal: ValueRange } | null
    > = {};

    if (!data || data.length === 0) return ranges;

    // Get all metric column keys
    const metricKeys = new Set(
      filteredColumnsMeta
        .filter(col => col.isMetric || col.isPercentMetric)
        .map(col => col.key),
    );

    // Calculate ranges for each metric column once
    metricKeys.forEach(key => {
      const nums = data
        .map(row => row?.[key])
        .filter(value => typeof value === 'number') as number[];

      if (nums.length === data.length) {
        const absNums = nums.map(Math.abs);
        ranges[key] = {
          aligned: [0, d3Max(absNums)!] as ValueRange,
          normal: d3Extent(nums) as ValueRange,
        };
      } else {
        ranges[key] = null;
      }
    });

    return ranges;
  }, [data, filteredColumnsMeta]);

  const getValueRange = useCallback(
    (key: string, alignPositiveNegative: boolean): ValueRange | null => {
      const columnRanges = valueRanges[key];
      if (!columnRanges) return null;
      return alignPositiveNegative ? columnRanges.aligned : columnRanges.normal;
    },
    [valueRanges],
  );

  return { valueRanges, getValueRange };
}
