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
import { buildQueryContext, QueryFormData, TimeGranularity } from '@superset-ui/core';

const SUBDOMAIN_TO_TIME_GRAIN: Record<string, TimeGranularity> = {
  min: TimeGranularity.MINUTE,
  hour: TimeGranularity.HOUR,
  day: TimeGranularity.DAY,
  week: TimeGranularity.WEEK,
  month: TimeGranularity.MONTH,
  year: TimeGranularity.YEAR,
};

/**
 * Mirrors the legacy CalHeatmapViz.query_obj: a timeseries query whose
 * time grain is forced from the subdomain granularity control.
 */
export default function buildQuery(formData: QueryFormData) {
  const { subdomain_granularity } = formData;
  const timeGrain =
    SUBDOMAIN_TO_TIME_GRAIN[(subdomain_granularity as string) ?? 'min'] ??
    TimeGranularity.MINUTE;
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      is_timeseries: true,
      extras: {
        ...baseQueryObject.extras,
        time_grain_sqla: timeGrain,
      },
    },
  ]);
}
