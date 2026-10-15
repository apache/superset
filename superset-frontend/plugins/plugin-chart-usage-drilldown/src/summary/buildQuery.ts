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
  BinaryQueryObjectFilterClause,
  buildQueryContext,
  getXAxisColumn,
  NO_TIME_RANGE,
  QueryFormColumn,
  QueryObject,
  QueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { UsageSummaryFormData } from './types';
import { alwaysOneRow } from '../alwaysOneRow';

/** Range used when no time filter is set: the 7 days before today. */
export const DEFAULT_TIME_RANGE = 'Last week';

const isTemporalRange = (
  filter: QueryObjectFilterClause,
): filter is BinaryQueryObjectFilterClause => filter.op === 'TEMPORAL_RANGE';

/**
 * Falls back to DEFAULT_TIME_RANGE when neither the chart nor a dashboard
 * filter sets a time range, so the chart opens with one bar per day for the
 * last 7 days instead of the whole table. The backend copies `time_range`
 * into every TEMPORAL_RANGE filter, and one is added on the time column if
 * there is none.
 */
function withDefaultTimeRange(
  query: QueryObject,
  timeColumn: QueryFormColumn | undefined,
): QueryObject {
  const filters = query.filters ?? [];
  const range =
    query.time_range ?? filters.find(isTemporalRange)?.val ?? NO_TIME_RANGE;
  if (range !== NO_TIME_RANGE || !timeColumn) return query;
  return {
    ...query,
    time_range: DEFAULT_TIME_RANGE,
    filters: filters.some(isTemporalRange)
      ? filters
      : [
          ...filters,
          { col: timeColumn, op: 'TEMPORAL_RANGE', val: DEFAULT_TIME_RANGE },
        ],
  };
}

// Always fetches hourly totals: short time ranges (e.g. "Last 3 hours") are
// drawn per hour, longer ones are summed into days in the browser, so
// switching the bucket size does not re-query the database.
export default function buildQuery(formData: UsageSummaryFormData) {
  const hourly = { ...formData, time_grain_sqla: TimeGranularity.HOUR };
  const timeColumn = getXAxisColumn(hourly);

  return buildQueryContext(hourly, query => {
    const baseQueryObject = withDefaultTimeRange(query, timeColumn);
    return [
      {
        ...baseQueryObject,
        columns: timeColumn ? [timeColumn] : [],
        metrics: [
          formData.metric,
          ...(formData.success_metric && formData.failed_metric
            ? [formData.success_metric, formData.failed_metric]
            : []),
        ],
      },
      alwaysOneRow(baseQueryObject, formData.metric),
    ];
  });
}
