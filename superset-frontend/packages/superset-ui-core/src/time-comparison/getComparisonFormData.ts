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
import { AdhocFilter } from '../types';
import getComparisonTimeRangeComparator from './getComparisonTimeRangeComparator';
import { ComparisonTimeRangeType } from './types';

export const getComparisonFormData = (
  formData: QueryFormData,
  timeComparison: string,
  extraFormData: any,
): QueryFormData => {
  const timeFilterIndex: number =
    formData.adhoc_filters?.findIndex(
      filter => 'operator' in filter && filter.operator === 'TEMPORAL_RANGE',
    ) ?? -1;

  const timeFilter: AdhocFilter | null =
    timeFilterIndex !== -1 && formData.adhoc_filters
      ? formData.adhoc_filters[timeFilterIndex]
      : null;

  let formDataB: QueryFormData;
  let queryBComparator = null;

  if (timeComparison !== ComparisonTimeRangeType.Custom) {
    queryBComparator = getComparisonTimeRangeComparator(
      formData.adhoc_filters || [],
      timeComparison,
      extraFormData,
    );

    const queryBFilter: any = {
      ...timeFilter,
      comparator: queryBComparator,
    };

    const otherFilters = formData.adhoc_filters?.filter(
      (_value: any, index: number) => timeFilterIndex !== index,
    );
    const queryBFilters = otherFilters
      ? [queryBFilter, ...otherFilters]
      : [queryBFilter];

    formDataB = {
      ...formData,
      adhoc_filters: queryBFilters,
      extra_form_data: {
        ...extraFormData,
        time_range: undefined,
      },
    };
  } else {
    formDataB = {
      ...formData,
      adhoc_filters: formData.adhoc_custom,
      extra_form_data: {
        ...extraFormData,
        time_range: undefined,
      },
    };
  }

  return formDataB;
};

export default getComparisonFormData;
