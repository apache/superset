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
  ContextMenuFilters,
  JsonObject,
  ensureIsArray,
} from '@superset-ui/core';

type DrillByConfig = ContextMenuFilters['drillBy'];

/**
 * Return the time range of the innermost temporal bucket a Drill by was
 * started from, i.e. the value of the last TEMPORAL_RANGE drill filter.
 * Each further drill narrows the previous one, so the last bucket is the
 * one to query.
 */
export const getDrillByTimeRange = (
  configs: DrillByConfig[],
): string | undefined => {
  let timeRange: string | undefined;
  configs.forEach(config => {
    ensureIsArray(config?.filters).forEach(filter => {
      if (
        filter.op === 'TEMPORAL_RANGE' &&
        typeof filter.val === 'string' &&
        filter.val
      ) {
        timeRange = filter.val;
      }
    });
  });
  return timeRange;
};

/**
 * Make a drilled query keep the clicked temporal bucket.
 *
 * The backend replaces the value of every TEMPORAL_RANGE filter with the
 * query's time_range, so a bucket sent only as a TEMPORAL_RANGE filter is
 * widened to the chart's (or dashboard's) whole time range. Carrying the
 * bucket as the query's time_range keeps it. A dashboard time range arrives
 * through extra_form_data, which overrides time_range, so it is replaced
 * there as well. The bucket lies inside the chart's displayed range, so
 * the result is the intersection of both.
 *
 * TEMPORAL_RANGE is kept, rather than a >= / < pair, because only the
 * TEMPORAL_RANGE path applies the dataset's timezone or Hours offset to the
 * bounds.
 */
export const applyDrillByTimeRange = <T extends JsonObject>(
  formData: T,
  timeRange: string | undefined,
): T => {
  if (!timeRange) {
    return formData;
  }
  const extraFormData = formData.extra_form_data as JsonObject | undefined;
  return {
    ...formData,
    time_range: timeRange,
    ...(extraFormData?.time_range !== undefined && {
      extra_form_data: { ...extraFormData, time_range: timeRange },
    }),
  };
};
