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
 * Timeseries-specific: Series type override
 * Used by charts with series (timeseries, bar, etc.)
 */

export type PtmSeriesType = 'auto' | 'line' | 'bar' | 'smooth' | 'step';


export function applySeriesTypeOverride(
  options: Record<string, unknown>,
  ptmSeriesType?: PtmSeriesType,
): Record<string, unknown> {
  if (
    !ptmSeriesType ||
    ptmSeriesType === 'auto' ||
    !options ||
    !Array.isArray(options.series)
  ) {
    return options;
  }

  const typeForEcharts =
    ptmSeriesType === 'smooth' || ptmSeriesType === 'step' ? 'line' : ptmSeriesType;

  return {
    ...options,
    series: options.series.map((s: Record<string, unknown>) => {
      const next: Record<string, unknown> = { ...s, type: typeForEcharts };

      if (ptmSeriesType === 'smooth') {
        next.smooth = true;
      }
      if (ptmSeriesType === 'step') {
        next.step = 'middle';
        next.smooth = false;
      }
      if (ptmSeriesType === 'bar') {
        delete next.smooth;
        delete next.step;
        next.itemStyle = {
          ...((next.itemStyle as Record<string, unknown>) || {}),
          borderRadius: [8, 8, 8, 8],
        };
        next.barMaxWidth = 48;
      }

      return next;
    }),
  };
}

