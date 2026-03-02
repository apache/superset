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

import type { EChartsCoreOption } from 'echarts/core';
import type { CustomEChartOptions } from './echartOptionsTypes';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merges custom EChart options into base options.
 * Arrays are replaced entirely, objects are merged recursively.
 *
 * @param baseOptions - The base ECharts options object
 * @param customOptions - Custom options to merge (from safeParseEChartOptions)
 * @returns Merged ECharts options
 */
export function mergeCustomEChartOptions<T extends EChartsCoreOption>(
  baseOptions: T,
  customOptions: CustomEChartOptions | undefined,
): T & Partial<CustomEChartOptions> {
  type MergedResult = T & Partial<CustomEChartOptions>;

  if (!customOptions) {
    return baseOptions as MergedResult;
  }

  const result = { ...baseOptions } as MergedResult;

  for (const key of Object.keys(customOptions) as Array<
    keyof typeof customOptions
  >) {
    const customValue = customOptions[key];
    const baseValue = result[key as keyof T];

    if (customValue === undefined) {
      continue;
    }

    if (isPlainObject(customValue) && isPlainObject(baseValue)) {
      // Recursively merge nested objects
      (result as PlainObject)[key] = mergeCustomEChartOptions(
        baseValue as EChartsCoreOption,
        customValue as CustomEChartOptions,
      );
    } else {
      // Replace arrays and primitive values directly
      (result as PlainObject)[key] = customValue;
    }
  }

  return result;
}

export default mergeCustomEChartOptions;
