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

import { ComparisonTimeRangeType } from './types';

/**
 * Get the time shift text for the comparison
 * @param timeComparison - the time comparison
 * @returns the time shift text: '1 year', '1 month', '1 week', 'inherited' or undefined
 */
export const getComparisonTimeShiftText = (
  timeComparison: string,
): string | undefined => {
  if (timeComparison !== ComparisonTimeRangeType.Custom) {
    if (timeComparison === ComparisonTimeRangeType.InheritedRange) {
      return 'inherited';
    }
    if (timeComparison === ComparisonTimeRangeType.Year) {
      return '1 year';
    }
    if (timeComparison === ComparisonTimeRangeType.Month) {
      return '1 month';
    }
    if (timeComparison === ComparisonTimeRangeType.Week) {
      return '1 week';
    }
  }
  return undefined;
};

export default getComparisonTimeShiftText;
