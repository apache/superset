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
import {
  buildQueryContext,
  QueryFormData,
  PostProcessingRule,
  ensureIsArray,
  SimpleAdhocFilter,
  getTimeOffset,
  parseDttmToDate,
} from '@superset-ui/core';
import {
  isTimeComparison,
  timeCompareOperator,
} from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';

export default function buildQuery(formData: QueryFormData) {
  const { cols: groupby } = formData;

  const queryContextA = buildQueryContext(formData, baseQueryObject => {
    const postProcessing: PostProcessingRule[] = [];
    postProcessing.push(timeCompareOperator(formData, baseQueryObject));
    const TimeRangeFilters =
      formData.adhoc_filters?.filter(
        (filter: SimpleAdhocFilter) => filter.operator === 'TEMPORAL_RANGE',
      ) || [];

    // In case the viz is using all version of controls, we try to load them
    const previousCustomTimeRangeFilters: any =
      formData.adhoc_custom?.filter(
        (filter: SimpleAdhocFilter) => filter.operator === 'TEMPORAL_RANGE',
      ) || [];

    let previousCustomStartDate = '';
    if (
      !isEmpty(previousCustomTimeRangeFilters) &&
      previousCustomTimeRangeFilters[0]?.comparator !== 'No Filter'
    ) {
      previousCustomStartDate =
        previousCustomTimeRangeFilters[0]?.comparator.split(' : ')[0];
    }

    const timeOffsets = ensureIsArray(
      isTimeComparison(formData, baseQueryObject)
        ? getTimeOffset({
            timeRangeFilter: {
              ...TimeRangeFilters[0],
              comparator:
                baseQueryObject?.time_range ??
                (TimeRangeFilters[0] as any)?.comparator,
            },
            shifts: formData.time_compare,
            startDate:
              previousCustomStartDate && !formData.start_date_offset
                ? parseDttmToDate(previousCustomStartDate)?.toUTCString()
                : formData.start_date_offset,
          })
        : [],
    );
    return [
      {
        ...baseQueryObject,
        groupby,
        post_processing: postProcessing,
        time_offsets: isTimeComparison(formData, baseQueryObject)
          ? ensureIsArray(timeOffsets)
          : [],
      },
    ];
  });

  return {
    ...queryContextA,
  };
}
