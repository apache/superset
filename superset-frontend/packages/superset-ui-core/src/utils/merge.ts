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

import { mergeWith } from 'lodash';

/**
 * Merges objects using lodash.mergeWith, but replaces arrays instead of concatenating them.
 * This is useful for configuration objects where you want to completely override array values
 * rather than merge them by index.
 *
 * @example
 * const obj1 = { a: [1, 2], b: { c: 3 } };
 * const obj2 = { a: [4, 5], b: { d: 6 } };
 * mergeReplaceArrays(obj1, obj2);
 * // Result: { a: [4, 5], b: { c: 3, d: 6 } }
 *
 * @example
 * // ECharts configuration merging
 * const baseConfig = { series: [{ type: 'line' }], grid: { left: '10%' } };
 * const overrides = { series: [{ type: 'bar' }], grid: { right: '10%' } };
 * mergeReplaceArrays(baseConfig, overrides);
 * // Result: { series: [{ type: 'bar' }], grid: { left: '10%', right: '10%' } }
 *
 * @param sources - Objects to merge (rightmost wins for arrays, deep merge for objects)
 * @returns Merged object with arrays replaced, not concatenated
 */
export function mergeReplaceArrays<T = any>(...sources: any[]): T {
  const replaceArrays = (objValue: any, srcValue: any) => {
    if (Array.isArray(srcValue)) {
      return srcValue; // Replace arrays entirely
    }
    return undefined; // Let lodash handle object merging for non-arrays
  };

  return mergeWith({}, ...sources, replaceArrays);
}
