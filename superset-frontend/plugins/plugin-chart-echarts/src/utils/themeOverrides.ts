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
import { mergeWith, isPlainObject } from 'lodash';

/**
 * Custom merge function for ECharts theme overrides.
 *
 * This function extends lodash's mergeWith with special handling:
 * 1. Arrays in source values replace destination arrays entirely (backward compatibility)
 * 2. When source is a plain object and destination is an array, the object is merged
 *    into each array item (allowing default styles to be applied to all items)
 *
 * This enables theme authors to write intuitive overrides like:
 * ```js
 * echartsOptionsOverridesByChartType: {
 *   echarts_bar: {
 *     series: { itemStyle: { borderRadius: 4 } },  // Applied to ALL series
 *     yAxis: { axisLabel: { rotate: 45 } }         // Applied to ALL y-axes
 *   }
 * }
 * ```
 *
 * Without this special handling, specifying `series` or `yAxis` as objects would
 * fail because the chart's actual values are arrays, and standard object merging
 * doesn't make sense for array-to-object merges.
 *
 * @param sources - Objects to merge (rightmost wins, with special array handling)
 * @returns Merged object with the custom array-object merge behavior
 *
 * @example
 * // Chart has multiple series:
 * const chartOptions = {
 *   series: [
 *     { type: 'bar', name: 'Revenue', data: [1, 2, 3] },
 *     { type: 'bar', name: 'Profit', data: [4, 5, 6] }
 *   ]
 * };
 *
 * // Theme override with object (not array):
 * const override = {
 *   series: { itemStyle: { borderRadius: 4 } }
 * };
 *
 * // Result: borderRadius applied to EACH series
 * mergeEchartsThemeOverrides(chartOptions, override);
 * // {
 * //   series: [
 * //     { type: 'bar', name: 'Revenue', data: [1, 2, 3], itemStyle: { borderRadius: 4 } },
 * //     { type: 'bar', name: 'Profit', data: [4, 5, 6], itemStyle: { borderRadius: 4 } }
 * //   ]
 * // }
 */
export function mergeEchartsThemeOverrides<T = any>(...sources: any[]): T {
  const customizer = (objValue: any, srcValue: any): any => {
    // If source is an array, replace entirely (backward compatibility)
    if (Array.isArray(srcValue)) {
      return srcValue;
    }

    // If destination is an array and source is a plain object,
    // merge the object into each array item (apply defaults to all items)
    if (Array.isArray(objValue) && isPlainObject(srcValue)) {
      return objValue.map(item =>
        isPlainObject(item) ? mergeWith({}, item, srcValue, customizer) : item,
      );
    }

    // Let lodash handle other cases (deep object merge, primitives, etc.)
    return undefined;
  };

  return mergeWith({}, ...sources, customizer);
}
