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
import { JsonPrimitive } from '@superset-ui/core';

export type NaNTreatment = 'alwaysLast' | 'asSmallest' | 'asLargest';

/**
 * Array.sort(...) comparator for potential numeric values with the ability to
 * treat null and NaN as the smallest or largest values or always sort to bottom.
 */
export default function sortNumericValues(
  valueA: JsonPrimitive,
  valueB: JsonPrimitive,
  {
    descending = false,
    nanTreatment = 'alwaysLast',
  }: { descending?: boolean; nanTreatment?: NaNTreatment } = {},
) {
  let orderByIsNaN =
    Number(valueA == null) - Number(valueB == null) ||
    Number(Number.isNaN(Number(valueA))) - Number(Number.isNaN(Number(valueB)));

  // if A is null or NaN and B is not, `orderByIsNaN` is 1,
  // which will make A come after B in the sorted array,
  // since we want to treat A as smallest number, we need to flip the sign
  // when sorting in ascending order.
  if (nanTreatment === 'asSmallest' && !descending) {
    orderByIsNaN = -orderByIsNaN;
  }
  if (nanTreatment === 'asLargest' && descending) {
    orderByIsNaN = -orderByIsNaN;
  }
  return (
    orderByIsNaN || (Number(valueA) - Number(valueB)) * (descending ? -1 : 1)
  );
}
