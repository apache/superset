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

import { QueryFormData } from '../query';
import { getComparisonFilters } from './getComparisonFilters';
import { ComparisonTimeRangeType } from './types';

/**
 * This is the main function to get the comparison info. It will return the formData
 * that a viz can use to query the comparison data and the time shift text needed for
 * the comparison time range based on the control value.
 * @param formData
 * @param timeComparison
 * @param extraFormData
 * @returns the processed formData
 */

export const getComparisonInfo = (
  formData: QueryFormData,
  timeComparison: string,
  extraFormData: any,
): QueryFormData => {
  let comparisonFormData;

  if (timeComparison !== ComparisonTimeRangeType.Custom) {
    comparisonFormData = {
      ...formData,
      adhoc_filters: getComparisonFilters(formData, extraFormData),
      extra_form_data: {
        ...extraFormData,
        time_range: undefined,
      },
    };
  } else {
    // This is when user selects Custom as time comparison
    comparisonFormData = {
      ...formData,
      adhoc_filters: formData.adhoc_custom,
      extra_form_data: {
        ...extraFormData,
        time_range: undefined,
      },
    };
  }

  return comparisonFormData;
};

export default getComparisonInfo;
